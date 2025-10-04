import type {
	Invalidable,
	Invalidator,
	TileAssignment,
	WithTileId,
} from "@mandelbrot/common";
import { DisposeFlag, InvalidatorPool } from "@mandelbrot/common";
import { TileStore } from "./store";
import type {
	Supervisor,
	SupervisorsReceiveMessage,
	SupervisorsResult,
} from "./supervisors/supervisor";

type WorkerId = number;
type Generation = number;
type Timestamp = number;

export interface JobQueueProps {
	poolSize: number;
	dirtyOnJobEnd: boolean;
	dirtyOnJobStart: boolean;
}

export class JobQueue<ST extends Supervisor<unknown, WithTileId>>
	implements Invalidable
{
	/** Invalidation */
	private readonly dirtyOnJobStart: boolean;
	private readonly dirtyOnJobEnd: boolean;
	private readonly invalidatorPool: InvalidatorPool;

	/** Lifetime */
	private disposeFlag: DisposeFlag;
	private generation: Generation;

	/** Keeping track of workers */
	private poolSize: number;
	private workersHired: number;
	private readonly workers: Map<WorkerId, Worker>;
	private readonly idle: WorkerId[];

	/** Jobs to do and assigned */
	private readonly jobQueue: TileAssignment[];
	private readonly assignments: Map<
		WorkerId,
		[Generation, Timestamp, TileAssignment]
	>;

	/** Composed classes */
	private readonly supervisor: ST;
	private readonly store: TileStore<SupervisorsResult<ST>>;

	private total: number;
	private times: number[];

	public constructor(
		supervisor: ST,
		store: TileStore<SupervisorsResult<ST>>,
		props: Partial<JobQueueProps>,
	) {
		const {
			poolSize = 1,
			dirtyOnJobStart = false,
			dirtyOnJobEnd = true,
		} = props;

		this.store = store;
		this.supervisor = supervisor;
		this.invalidatorPool = new InvalidatorPool();
		this.disposeFlag = new DisposeFlag("Using disposed JobQueue.");

		this.poolSize = poolSize;
		this.dirtyOnJobEnd = dirtyOnJobEnd;
		this.dirtyOnJobStart = dirtyOnJobStart;

		this.assignments = new Map();
		this.workers = new Map();

		this.jobQueue = [];
		this.idle = [];
		this.workersHired = 0;
		this.generation = 0;

		this.total = 0;
		this.times = [];

		this.hireWorkersUntilPoolSizeIsFilled();
	}

	public setPoolSize(poolSize: number): void {
		this.disposeFlag.assertNotDisposed();
		this.poolSize = poolSize;
		this.fireIdleWorkersUntilPoolSizeIsMatched();
		this.hireWorkersUntilPoolSizeIsFilled();
		this.pump();
	}

	public getPoolSize(): number {
		this.disposeFlag.assertNotDisposed();
		return this.poolSize;
	}

	public addInvalidator(inv: Invalidator): void {
		this.invalidatorPool.addInvalidator(inv);
	}

	public removeInvalidator(inv: Invalidator): void {
		this.invalidatorPool.removeInvalidator(inv);
	}

	public getWorkerBusyness(): boolean[] {
		this.disposeFlag.assertNotDisposed();

		const busyness: boolean[] = [];
		const perWorker: Map<WorkerId, boolean> = new Map();

		for (const workerId of this.workers.keys()) {
			perWorker.set(workerId, false);
		}

		for (const workerId of this.assignments.keys()) {
			perWorker.set(workerId, true);
		}

		for (const busy of perWorker.values()) {
			busyness.push(busy);
		}

		return busyness;
	}

	public getRenderTimePerTile(): number {
		return this.total / this.times.length;
	}

	public getQueueSize(): number {
		return this.jobQueue.length;
	}

	public enqueueEnd(...assignments: TileAssignment[]): void {
		this.disposeFlag.assertNotDisposed();
		this.jobQueue.push(...assignments);
		this.pump();
	}

	public enqueueStart(...assignments: TileAssignment[]): void {
		this.disposeFlag.assertNotDisposed();
		this.jobQueue.unshift(...assignments);
		this.pump();
	}

	public prune(): void {
		this.disposeFlag.assertNotDisposed();
		this.jobQueue.length = 0;
	}

	public clear(): void {
		this.disposeFlag.assertNotDisposed();
		this.jobQueue.length = 0;
		this.generation += 1;

		this.total = 0;
		this.times.length = 0;
	}

	public dispose(): void {
		this.disposeFlag.assertNotDisposed();
		this.disposeFlag.set();
		this.assignments.clear();
		this.jobQueue.length = 0;

		this.workers.forEach((worker) => {
			this.workersHired -= 1;
			try {
				worker.terminate();
			} catch {
				// Not a problem...
			}
		});

		this.idle.length = 0;
		this.workers.clear();
	}

	private pump(): void {
		if (this.disposeFlag.read()) return;

		while (this.idle.length > 0) {
			const assignment = this.jobQueue.shift();
			if (!assignment) break;

			const workerId = this.idle.pop()!;
			const worker = this.workers.get(workerId)!;

			this.assignments.set(workerId, [
				this.generation,
				performance.now(),
				assignment,
			]);
			this.store.setRendering(assignment.tileId);
			this.supervisor.assignWorker(worker, assignment);

			if (this.dirtyOnJobStart) this.invalidatorPool.invalidate();
		}
	}

	private hireWorkersUntilPoolSizeIsFilled(): void {
		for (
			let workerId = this.workersHired;
			workerId < this.poolSize;
			workerId++
		) {
			this.registerWorker(workerId, this.supervisor.hireWorker());
			this.workersHired += 1;
		}
	}

	private fireIdleWorkersUntilPoolSizeIsMatched(): void {
		for (
			let workerId = this.poolSize;
			workerId < this.workersHired;
			workerId++
		) {
			if (this.idle.includes(workerId)) {
				this.fireWorker(workerId);
			}
		}
	}

	private fireWorker(workerId: WorkerId): void {
		const worker = this.workers.get(workerId);
		if (worker) {
			const i = this.idle.indexOf(workerId);
			if (i !== -1) this.idle.splice(i, 1);

			this.workers.delete(workerId);
			this.workersHired -= 1;
			try {
				worker.terminate();
			} catch {
				// Not a problem...
			}
		} else {
			throw new Error("Trying to fire nonexistent worker");
		}
	}

	private registerWorker(workerId: WorkerId, worker: Worker): void {
		worker.addEventListener("message", this.newDoneHandler(workerId));
		worker.addEventListener("error", this.newErrorHandler(workerId));

		this.workers.set(workerId, worker);
		this.idle.push(workerId);
	}

	private newDoneHandler = (workerId: WorkerId) => {
		return (event: MessageEvent<SupervisorsReceiveMessage<ST>>) => {
			this.handleDone(workerId, event.data);
		};
	};

	private newErrorHandler = (workerId: WorkerId) => {
		return (error: ErrorEvent) => {
			this.handleError(workerId, error);
		};
	};

	private handleDone = (
		workerId: WorkerId,
		message: SupervisorsReceiveMessage<ST>,
	) => {
		if (this.disposeFlag.read()) return;

		const genAssig = this.assignments.get(workerId);

		if (genAssig) {
			const [generation, timestamp] = genAssig;

			this.assignments.delete(workerId);
			this.supervisor.collectResult(message).then((value) => {
				if (generation == this.generation) {
					const delta = performance.now() - timestamp;
					this.total += delta;
					this.times.push(delta);

					if (this.times.length > 100) {
						const poped = this.times.shift()!;
						this.total -= poped;
					}

					this.store.setReady(value.tileId, value as SupervisorsResult<ST>);
					if (this.dirtyOnJobEnd) this.invalidatorPool.invalidate();
				}
			});
		}

		if (workerId < this.poolSize) {
			this.idle.push(workerId);
			this.pump();
		} else {
			this.fireWorker(workerId);
		}
	};

	private handleError = (workerId: WorkerId, error: ErrorEvent): void => {
		const genAssig = this.assignments.get(workerId);

		console.error("Worker failed", error);

		try {
			this.workers.get(workerId)!.terminate();
		} finally {
			const replacement = this.supervisor.hireWorker();

			this.registerWorker(workerId, replacement);

			if (genAssig !== undefined) {
				this.assignments.delete(workerId);
				const [generation, , assignment] = genAssig;

				if (generation == this.generation) {
					this.redoUnfinishedJobs(assignment);
				}
			}
		}
	};

	private redoUnfinishedJobs(...assignments: TileAssignment[]): void {
		this.store.resetFailedTileToQueue(assignments.map((a) => a.tileId));
		this.enqueueStart(...assignments);
	}
}
