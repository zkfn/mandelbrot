import { TileStore } from "@lib/store";
// import DummyWorker from "@workers/dummy.ts?worker";
import MandelbrotWorker from "@workers/mandelbrot.ts?worker";
import type { ReadAndClearFlag } from "@common/flag";
import type { WorkerOutMessage, WorkerInMessage } from "@common/protocol";
import { tileId, type Tile, type TileId } from "@common/tiles";

type JobId = number;
type WorkerId = number;

interface AssignedJobRecord {
	jobId: JobId;
	tileId: TileId;
	tile: Tile;
	worker: Worker;
}

export class WorkerExecutorQueue<Payload, StorePayload> {
	private disposed = false;
	private tileQueue: Tile[];

	private jobSeq: JobId;
	private convert: (item: Payload, tile: Tile) => Promise<StorePayload>;

	// TODO too complicate, we can map workers direclty to jobs.
	private readonly assignedJobs: Map<JobId, AssignedJobRecord>;
	private readonly assignedWorkers: Map<WorkerId, JobId>;

	private readonly workers: Worker[];
	private readonly idle: WorkerId[];

	private readonly poolSize: number;
	private readonly dirtyFlag: ReadAndClearFlag;
	private readonly store: TileStore<StorePayload>;

	constructor(
		store: TileStore<StorePayload>,
		dirtyFlag: ReadAndClearFlag,
		poolSize: number = 8,
		convert: (item: Payload, tile: Tile) => Promise<StorePayload>,
	) {
		this.jobSeq = 0;
		this.poolSize = poolSize;
		this.dirtyFlag = dirtyFlag;
		this.convert = convert;
		this.store = store;

		this.assignedJobs = new Map();
		this.assignedWorkers = new Map();

		this.workers = Array(poolSize);
		this.idle = [];
		this.tileQueue = [];

		for (let workerId = 0; workerId < this.poolSize; workerId++) {
			const worker = new MandelbrotWorker();
			this.registerWorker(workerId, worker);
		}
	}

	public enqueue(tile: Tile) {
		this.tileQueue.push(tile);
		this.pump();
	}

	public clearQueue() {
		this.tileQueue.length = 0;
	}

	public dispose(): void {
		this.disposed = true;

		this.assignedJobs.clear();
		this.assignedWorkers.clear();

		this.workers.forEach((worker) => {
			try {
				worker.terminate();
			} catch {}
		});

		this.idle.length = 0;
		this.workers.length = 0;
		this.clearQueue();
	}

	private registerWorker(workerId: WorkerId, worker: Worker) {
		worker.addEventListener("message", this.newDoneHandler(workerId));
		worker.addEventListener("error", this.newErrorHandler(workerId, worker));

		this.workers[workerId] = worker;
		this.idle.push(workerId);
	}

	private newDoneHandler = (workerId: WorkerId) => {
		return (event: MessageEvent<WorkerOutMessage<Payload>>) => {
			this.handleDone(workerId, event.data);
		};
	};

	private newErrorHandler = (workerId: WorkerId, worker: Worker) => {
		return (error: ErrorEvent) => {
			this.handleError(workerId, worker, error);
		};
	};

	private handleDone = (
		workerId: WorkerId,
		message: WorkerOutMessage<Payload>,
	) => {
		if (this.disposed) return;

		const record = this.assignedJobs.get(message.jobId);

		if (record) {
			this.assignedJobs.delete(message.jobId);
			this.assignedWorkers.delete(workerId);

			this.convert(message.payload, message.tile).then((value) => {
				this.store.setReady(tileId(message.tile), value);
				this.dirtyFlag.set();
			});
		}

		this.idle.push(workerId);
		this.pump();
	};

	private handleError(
		workerId: WorkerId,
		worker: Worker,
		error: ErrorEvent,
	): void {
		const jobId = this.assignedWorkers.get(workerId);

		if (jobId !== undefined) {
			const assignedJob = this.assignedJobs.get(jobId);

			this.assignedWorkers.delete(workerId);
			this.assignedJobs.delete(jobId);

			if (assignedJob !== undefined) {
				this.enqueue(assignedJob.tile);
				this.store.resetFailedTileToQueue(assignedJob.tileId);
			}
		}

		console.error("Worker failed", error);

		try {
			worker.terminate();
		} finally {
			const replacement = new MandelbrotWorker();
			this.registerWorker(workerId, replacement);
			this.pump();
		}
	}

	private pump(): void {
		if (this.disposed) return;

		while (this.idle.length > 0) {
			const tile = this.tileQueue.shift();
			if (!tile) break;

			const workerId = this.idle.pop()!;
			const jobId = this.jobSeq;
			const tid = tileId(tile);

			const worker = this.workers[workerId];

			this.store.setRendering(tid);
			this.assignedWorkers.set(workerId, jobId);
			this.assignedJobs.set(jobId, {
				jobId,
				worker,
				tile,
				tileId: tid,
			});

			worker.postMessage({
				jobId,
				tile,
				tileId: tid,
				maxIter: 1500,
			} as WorkerInMessage);

			// TODO this should be removed on prod
			this.dirtyFlag.set();
			this.jobSeq += 1;
		}
	}
}
