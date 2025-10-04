import { DisposeFlag } from "@mandelbrot/common";
import type { Supervisor } from "./supervisor";

type RunningJob<JobAssignment> = {
	generation: number;
	assignment: JobAssignment;
};

type WorkerID = number;

export class WorkerPool<JobAssignment, Transfer, Result> {
	private supervisor: Supervisor<JobAssignment, Transfer, Result>;
	private jobQueue: JobAssignment[];
	private generation: number;
	private poolSize: number;

	private runningJobs: Map<WorkerID, RunningJob<JobAssignment>>;
	private workers: Map<WorkerID, Worker>;
	private idle: WorkerID[];

	private disposeFlag: DisposeFlag;

	public constructor(
		supervisor: Supervisor<JobAssignment, Transfer, Result>,
		size: number,
	) {
		this.supervisor = supervisor;
		this.poolSize = size;
		this.jobQueue = [];
		this.generation = 0;

		this.disposeFlag = new DisposeFlag();
		this.runningJobs = new Map();
		this.workers = new Map();
		this.idle = [];

		this.hireWorkersUntilPoolIsFull();
	}

	public enqueueEnd(...assignments: JobAssignment[]): void {
		this.disposeFlag.assertNotDisposed();
		this.jobQueue.push(...assignments);
		this.pump();
	}

	public enqueueStart(...assignments: JobAssignment[]): void {
		this.disposeFlag.assertNotDisposed();
		this.jobQueue.unshift(...assignments);
		this.pump();
	}

	public setPoolSize(poolSize: number): void {
		this.disposeFlag.assertNotDisposed();
		this.poolSize = poolSize;
		this.fireIdleWorkersUntilPoolSizeIsMatched();
		this.hireWorkersUntilPoolIsFull();
		this.pump();
	}

	public getPoolSize(): number {
		this.disposeFlag.assertNotDisposed();
		return this.poolSize;
	}

	public getQueueSize(): number {
		return this.jobQueue.length;
	}

	public getWorkerBusyness(): boolean[] {
		this.disposeFlag.assertNotDisposed();

		const busyness: boolean[] = [];
		const perWorker: Map<WorkerID, boolean> = new Map();

		for (const workerId of this.workers.keys()) {
			perWorker.set(workerId, false);
		}

		for (const workerId of this.runningJobs.keys()) {
			perWorker.set(workerId, true);
		}

		for (const busy of perWorker.values()) {
			busyness.push(busy);
		}

		return busyness;
	}

	public clearQueue(): void {
		this.disposeFlag.assertNotDisposed();
		this.jobQueue.length = 0;
	}

	public clearQueueAndInvalidateRunningJobs(): void {
		this.disposeFlag.assertNotDisposed();
		this.jobQueue.length = 0;
		this.generation += 1;
	}

	public dispose(): void {
		this.disposeFlag.assertNotDisposed();
		this.disposeFlag.set();
		this.runningJobs.clear();
		this.jobQueue.length = 0;

		this.workers.forEach((worker) => {
			try {
				worker.terminate();
			} catch {
				// Not a problem...
			}
		});

		this.idle.length = 0;
		this.workers.clear();
	}

	private hireWorkersUntilPoolIsFull() {
		for (let workerId = 0; workerId < this.poolSize; workerId++) {
			if (this.workers.has(workerId)) continue;
			this.registerWorker(workerId, this.supervisor.hireWorker());
		}
	}

	private fireIdleWorkersUntilPoolSizeIsMatched(): void {
		for (
			let workerId = this.poolSize;
			workerId < this.workers.size;
			workerId++
		) {
			if (this.idle.includes(workerId)) {
				this.fireWorker(workerId);
			}
		}
	}

	private registerWorker(workerId: WorkerID, worker: Worker): void {
		worker.addEventListener("message", this.createDoneHandler(workerId));
		worker.addEventListener("error", this.createErrorHandler(workerId));

		this.workers.set(workerId, worker);
		this.idle.push(workerId);
	}

	private fireWorker(workerId: WorkerID): void {
		const worker = this.workers.get(workerId)!;
		const idleIndex = this.idle.indexOf(workerId);

		if (idleIndex !== -1) this.idle.splice(idleIndex, 1);
		this.workers.delete(workerId)!;

		try {
			worker.terminate();
		} catch {
			// Don't care...
		}
	}

	private createDoneHandler = (workerId: WorkerID) => {
		return (event: MessageEvent<Result>) => {
			this.handleDone(workerId, event.data);
		};
	};

	private createErrorHandler = (workerId: WorkerID) => {
		return (error: ErrorEvent) => {
			this.handleError(workerId, error);
		};
	};

	private handleDone = (workerId: WorkerID, result: Result) => {
		if (this.disposeFlag.read()) return;

		const { generation } = this.runningJobs.get(workerId)!;
		this.runningJobs.delete(workerId);

		if (generation == this.generation) {
			this.supervisor.collectResult(result);
		}

		if (workerId < this.poolSize) {
			this.idle.push(workerId);
			this.pump();
		} else {
			this.fireWorker(workerId);
		}
	};

	private handleError = (workerId: WorkerID, error: ErrorEvent): void => {
		if (this.disposeFlag.read()) return;

		const { assignment, generation } = this.runningJobs.get(workerId)!;
		this.runningJobs.delete(workerId);
		console.error("Worker failed", error);

		try {
			this.workers.get(workerId)?.terminate();
		} finally {
			const replacement = this.supervisor.hireWorker();
			this.registerWorker(workerId, replacement);

			if (generation == this.generation) {
				this.enqueueStart(assignment);
			}
		}
	};

	private pump(): void {
		if (this.disposeFlag.read()) return;

		while (this.idle.length > 0) {
			const assignment = this.jobQueue.shift();
			if (!assignment) break;

			const workerId = this.idle.pop()!;
			const worker = this.workers.get(workerId)!;

			this.runningJobs.set(workerId, {
				generation: this.generation,
				assignment,
			});

			const { payload, transfer } = this.supervisor.assignJob(assignment);
			if (transfer) {
				worker.postMessage(payload, transfer);
			} else {
				worker.postMessage(payload);
			}
		}
	}
}
