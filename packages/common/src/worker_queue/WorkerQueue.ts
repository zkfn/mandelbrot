import type {
  QueueToWorkerMessage,
  WorkerToQueueMessage,
  WorkerWithProtocol,
} from "../worker_protocol";

export type Job<TData> = {
  jobId: string;
  data: TData;
};

export type WorkerQueueConfig = {
  poolSize: number;
  batchSize: number;
  requeueWhenRemaning: number;
};

export interface WorkerWrapper<TData, TResult> {
  readonly id: number;
  cancel(jobIds: string[]): void;
  assignJobs(generation: number, jobs: { jobId: string; data: TData }[]): void;
  terminate(): void;
  kill(): void;
  setCallback(
    callback: (
      worker: WorkerWrapper<TData, TResult>,
      message: WorkerToQueueMessage<TResult>
    ) => void
  ): void;
}

export type WorkerFactory<TData, TResult> = (id: number) => WorkerWrapper<TData, TResult>;

export class SimpleWorkerWrapper<TData, TResult> implements WorkerWrapper<TData, TResult> {
  public readonly id: number;
  protected worker: WorkerWithProtocol<TData, TResult>;

  static asFactory = <TData, TResult>(workerGetter: () => WorkerWithProtocol<TData, TResult>) => {
    return (id: number) => new SimpleWorkerWrapper<TData, TResult>(id, workerGetter());
  };

  public constructor(id: number, worker: WorkerWithProtocol<TData, TResult>) {
    this.worker = worker;
    this.id = id;
  }

  public cancel = (jobIds: string[]) => {
    this.worker.postMessage({
      kind: "cancel",
      jobIds,
    } satisfies QueueToWorkerMessage<TData>);
  };

  public terminate = () => {
    this.worker.postMessage({
      kind: "terminate",
    } satisfies QueueToWorkerMessage<TData>);
  };

  public assignJobs = (generation: number, jobs: { jobId: string; data: TData }[]) => {
    this.worker.postMessage({
      kind: "assign",
      jobs,
      generation,
    } satisfies QueueToWorkerMessage<TData>);
  };

  public kill = () => {
    this.worker.terminate();
  };

  public setCallback = (
    callback: (
      worker: WorkerWrapper<TData, TResult>,
      message: WorkerToQueueMessage<TResult>
    ) => void
  ) => {
    this.worker.onmessage = (event: MessageEvent<WorkerToQueueMessage<TResult>>) => {
      callback(this, event.data);
    };
  };
}

export class WorkerQueue<TData, TResult> {
  private poolSize: number = 0;
  private batchSize: number = 0;
  private requeueWhenRemaning: number = 0;
  private generationCounter: number = 0;

  private jobQueue: Job<TData>[];
  private assignedJobs: Map<string, Job<TData>>;
  private jobsToWorkers: Map<string, WorkerWrapper<TData, TResult>>;

  private workerPool: Map<number, WorkerWrapper<TData, TResult>>;
  private workerQueue: WorkerWrapper<TData, TResult>[];

  private onResult: (jobId: string, result: TResult) => void;
  private workerFactory: WorkerFactory<TData, TResult>;

  public constructor(
    workerFactory: WorkerFactory<TData, TResult>,
    onResult: (jobId: string, result: TResult) => void,
    { poolSize, batchSize: chunkSize, requeueWhenRemaning }: WorkerQueueConfig
  ) {
    this.jobQueue = [];

    this.jobsToWorkers = new Map();
    this.assignedJobs = new Map();

    this.workerPool = new Map();
    this.workerQueue = [];
    this.generationCounter = 0;

    this.workerFactory = workerFactory;
    this.onResult = onResult;

    this.reconfigure({ poolSize, batchSize: chunkSize, requeueWhenRemaning });
  }

  public reconfigure({ poolSize, batchSize: chunkSize, requeueWhenRemaning }: WorkerQueueConfig) {
    this.poolSize = poolSize;
    this.batchSize = chunkSize;
    this.requeueWhenRemaning = requeueWhenRemaning;

    if (this.poolSize < 1) {
      throw new Error("poolSize must be at least 1");
    }

    if (this.batchSize < 1) {
      throw new Error("chunkSize must be at least 1");
    }

    if (this.requeueWhenRemaning < 0) {
      throw new Error("requeueWhenRemaning must be at least 0");
    }

    if (this.workerPool.size < this.poolSize) {
      for (let i = this.workerPool.size; i < this.poolSize; i++) {
        this.registerWorker(i);
      }
    } else if (this.workerPool.size > this.poolSize) {
      for (let i = this.workerPool.size - 1; i >= this.poolSize; i--) {
        this.fireWorker(i);
      }
    }
  }

  public setJobs(jobs: Job<TData>[]) {
    const ids = new Set(jobs.map((job) => job.jobId));
    const toCancel = new Map<WorkerWrapper<TData, TResult>, string[]>();

    for (const [jobId, worker] of this.jobsToWorkers) {
      if (!ids.has(jobId)) {
        let destination = toCancel.get(worker);

        if (destination === undefined) {
          destination = [];
          toCancel.set(worker, destination);
        }

        destination.push(jobId);
      }
    }

    this.jobQueue = [...jobs];

    toCancel.forEach((jobIds, worker) => {
      worker.cancel(jobIds);
    });

    if (this.workerQueue.length > 0 && this.jobQueue.length > 0) {
      this.seedJobs();
    }
  }

  public queuedJobs(): number {
    return this.jobQueue.length;
  }

  private seedJobs() {
    while (this.jobQueue.length > 0) {
      const worker = this.workerQueue.shift();
      if (!worker) {
        break;
      }

      const batch = this.jobQueue.splice(0, this.batchSize);
      const assignments = batch.map((job) => ({ jobId: job.jobId, data: job.data }));

      batch.forEach((job) => {
        this.assignedJobs.set(job.jobId, job);
      });

      assignments.forEach((assignment) => {
        this.jobsToWorkers.set(assignment.jobId, worker);
      });

      worker.assignJobs(this.generationCounter, assignments);
    }
  }

  private onMessage = (
    worker: WorkerWrapper<TData, TResult>,
    message: WorkerToQueueMessage<TResult>
  ) => {
    if (message.kind === "terminated") {
      this.redoJobs(message.jobIds);

      if (!message.finishingComputation) {
        this.workerPool.delete(worker.id);
      }

      return;
    }

    if (message.kind === "result") {
      const job = this.jobsToWorkers.get(message.jobId);

      if (job) {
        this.jobsToWorkers.delete(message.jobId);

        if (message.generation === this.generationCounter) {
          this.onResult(message.jobId, message.data);
        }
      }
    } else if (message.kind === "cancelled") {
      for (const jobId of message.jobIds) {
        this.jobsToWorkers.delete(jobId);
      }
    } else {
      throw new Error(`Unknown message kind: ${message}`);
    }

    if (worker.id >= this.poolSize) {
      if (message.remainingJobs === 0) {
        this.workerPool.delete(worker.id);
      }
    } else if (message.remainingJobs <= this.requeueWhenRemaning) {
      this.workerQueue.push(worker);
      this.seedJobs();
    }
  };

  private redoJobs(jobIds: string[]) {
    jobIds.forEach((jobId) => {
      const known = this.assignedJobs.get(jobId);

      if (known) {
        this.jobsToWorkers.delete(jobId);
        this.jobQueue.unshift(known);
      }
    });
  }

  private registerWorker(workerId: number) {
    if (this.workerPool.has(workerId)) {
      return;
    }

    const worker = this.workerFactory(workerId);
    worker.setCallback(this.onMessage);

    this.workerPool.set(workerId, worker);
    this.workerQueue.push(worker);
  }

  private fireWorker(workerId: number) {
    const worker = this.workerPool.get(workerId);

    if (worker) {
      this.workerQueue.splice(this.workerQueue.indexOf(worker), 1);
      worker.terminate();
    }
  }
}
