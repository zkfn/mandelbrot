import { TileStore } from "@lib/store";
import { ReadAndClearFlag } from "@common/flag";
import type {
	Supervisor,
	SupervisorsAssignment,
	SupervisorsReceiveMessage,
	SupervisorsResult,
} from "@lib/supervisors/supervisor";
import type { WithTileId } from "@common/tiles";

type WorkerId = number;

export class JobQueue<ST extends Supervisor<any, WithTileId, WithTileId>> {
	private poolSize: number;
	private hired: number;
	private disposed = false;
	private jobQueue: SupervisorsAssignment<ST>[];

	private readonly dirtyOnJobEnd: boolean;
	private readonly dirtyOnJobStart: boolean;

	private readonly assignments: Map<WorkerId, SupervisorsAssignment<ST>>;

	private readonly workers: Map<WorkerId, Worker>;
	private readonly idle: WorkerId[];

	private readonly store: TileStore<SupervisorsResult<ST>>;
	private readonly supervisor: ST;
	public readonly dirtyFlag: ReadAndClearFlag;

	constructor(
		supervisor: ST,
		store: TileStore<SupervisorsResult<ST>>,
		poolSize: number,
		dirtyOnJobEnd: boolean = false,
		dirtyOnJobStart: boolean = true,
	) {
		this.store = store;
		this.supervisor = supervisor;
		this.poolSize = poolSize;

		this.dirtyFlag = new ReadAndClearFlag(false);
		this.dirtyOnJobEnd = dirtyOnJobEnd;
		this.dirtyOnJobStart = dirtyOnJobStart;

		this.assignments = new Map();
		this.workers = new Map();

		this.jobQueue = [];
		this.idle = [];
		this.hired = 0;

		this.hireWorkersUntilPoolSizeIsFilled();
	}

	public setPoolSize(poolSize: number): void {
		this.poolSize = poolSize;
		this.hireWorkersUntilPoolSizeIsFilled();
		this.pump();
	}

	public enqueueEnd(...assignments: SupervisorsAssignment<ST>[]): void {
		this.jobQueue.push(...assignments);
		this.pump();
	}

	public enqueueStart(...assignments: SupervisorsAssignment<ST>[]): void {
		this.jobQueue.unshift(...assignments);
		this.pump();
	}

	public prune() {
		this.jobQueue.length = 0;
	}

	public dispose(): void {
		this.disposed = true;
		this.assignments.clear();
		this.jobQueue.length = 0;

		this.workers.forEach((worker) => {
			this.hired -= 1;
			try {
				worker.terminate();
			} catch {}
		});

		this.idle.length = 0;
		this.workers.clear();
	}

	private pump(): void {
		if (this.disposed) return;

		while (this.idle.length > 0) {
			const assignment = this.jobQueue.shift();
			if (!assignment) break;

			const workerId = this.idle.pop()!;
			const worker = this.workers.get(workerId)!;

			this.assignments.set(workerId, assignment);
			this.store.setRendering(assignment.tileId);
			this.supervisor.assignWorker(worker, assignment);

			if (this.dirtyOnJobStart) this.dirtyFlag.set();
		}
	}

	private hireWorkersUntilPoolSizeIsFilled() {
		for (let workerId = this.hired; workerId < this.poolSize; workerId++) {
			this.registerWorker(workerId, this.supervisor.hireWorker());
			this.hired += 1;
		}
	}

	private registerWorker(workerId: WorkerId, worker: Worker) {
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
		if (this.disposed) return;

		if (this.assignments.get(workerId)) {
			this.assignments.delete(workerId);

			this.supervisor.collectResult(message).then((value) => {
				this.store.setReady(value.tileId, value as SupervisorsResult<ST>);
				if (this.dirtyOnJobEnd) this.dirtyFlag.set();
			});
		}

		if (workerId <= this.poolSize) {
			this.idle.push(workerId);
			this.pump();
		} else {
			this.workers.delete(workerId);
			this.hired -= 1;
		}
	};

	private handleError = (workerId: WorkerId, error: ErrorEvent): void => {
		const assignment = this.assignments.get(workerId);

		console.error("Worker failed", error);

		try {
			this.workers.get(workerId)!.terminate();
		} finally {
			const replacement = this.supervisor.hireWorker();

			this.registerWorker(workerId, replacement);

			if (assignment !== undefined) {
				this.assignments.delete(workerId);
				this.redoUnfinishedJobs(assignment);
			}
		}
	};

	private redoUnfinishedJobs(...assignments: SupervisorsAssignment<ST>[]) {
		this.store.resetFailedTileToQueue(assignments.map((a) => a.tileId));
		this.enqueueStart(...assignments);
	}
}
