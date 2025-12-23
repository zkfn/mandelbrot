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
  cancel(jobIds: string[]): void;
  cancelAll(): void;
  assignJobs(generation: number, jobs: { jobId: string; data: TData }[]): void;
  invalidate(): void;
  setCallback(
    callback: (
      worker: WorkerWrapper<TData, TResult>,
      message: WorkerToQueueMessage<TResult>
    ) => void
  ): void;
}

export class SimpleWorkerWrapper<TData, TResult> implements WorkerWrapper<TData, TResult> {
  protected worker: WorkerWithProtocol<TData, TResult>;

  static asFactory = <TData, TResult>(workerGetter: () => WorkerWithProtocol<TData, TResult>) => {
    return () => new SimpleWorkerWrapper<TData, TResult>(workerGetter());
  };

  public constructor(worker: WorkerWithProtocol<TData, TResult>) {
    this.worker = worker;
  }

  public cancel = (jobIds: string[]) => {
    this.worker.postMessage({
      kind: "cancel",
      jobIds,
    } satisfies QueueToWorkerMessage<TData>);
  };

  public cancelAll = () => {
    this.worker.postMessage({
      kind: "cancel-all",
    } satisfies QueueToWorkerMessage<TData>);
  };

  public assignJobs = (generation: number, jobs: { jobId: string; data: TData }[]) => {
    this.worker.postMessage({
      kind: "assign",
      jobs,
      generation,
    } satisfies QueueToWorkerMessage<TData>);
  };

  public invalidate = () => {
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
  private jobs: Map<string, WorkerWrapper<TData, TResult>>;
  private workers: Map<number, WorkerWrapper<TData, TResult>>;
  private workerQueue: WorkerWrapper<TData, TResult>[];
  private onResult: (jobId: string, result: TResult) => void;
  private workerFactory: () => WorkerWrapper<TData, TResult>;

  public constructor(
    workerFactory: () => WorkerWrapper<TData, TResult>,
    onResult: (jobId: string, result: TResult) => void,
    { poolSize, batchSize: chunkSize, requeueWhenRemaning }: WorkerQueueConfig
  ) {
    this.jobQueue = [];
    this.jobs = new Map();
    this.workers = new Map();
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

    if (this.workers.size < this.poolSize) {
      for (let i = this.workers.size; i < this.poolSize; i++) {
        this.registerWorker();
      }
    } else if (this.workers.size > this.poolSize) {
      for (let i = this.workers.size; i > this.poolSize; i--) {
        this.fireWorker(i);
      }
    }
  }

  public setJobs(jobs: Job<TData>[]) {
    const ids = new Set(jobs.map((job) => job.jobId));
    const toCancel = new Map<WorkerWrapper<TData, TResult>, string[]>();

    for (const [jobId, worker] of this.jobs) {
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

    // Seed jobs if there are workers available
    if (this.workerQueue.length > 0 && this.jobQueue.length > 0) {
      this.seedJobs();
    }
  }

  private seedJobs() {
    while (this.jobQueue.length > 0) {
      const worker = this.workerQueue.shift();
      if (!worker) {
        break;
      }

      const batch = this.jobQueue.splice(0, this.batchSize);
      const assignments = batch.map((job) => ({ jobId: job.jobId, data: job.data }));

      for (const assignment of assignments) {
        this.jobs.set(assignment.jobId, worker);
      }

      worker.assignJobs(this.generationCounter, assignments);
    }
  }

  private onMessage = (
    worker: WorkerWrapper<TData, TResult>,
    message: WorkerToQueueMessage<TResult>
  ) => {
    if (message.kind === "result") {
      const job = this.jobs.get(message.jobId);

      if (job) {
        this.jobs.delete(message.jobId);

        if (message.generation === this.generationCounter) {
          this.onResult(message.jobId, message.data);
        }
      }

      if (message.remainingJobs <= this.requeueWhenRemaning) {
        this.workerQueue.push(worker);
        this.seedJobs();
      }
    } else if (message.kind === "cancelled") {
      for (const jobId of message.jobIds) {
        this.jobs.delete(jobId);
      }
      if (message.remainingJobs <= this.requeueWhenRemaning) {
        this.workerQueue.push(worker);
        this.seedJobs();
      }
    } else {
      throw new Error(`Unknown message kind: ${message}`);
    }
  };

  private registerWorker() {
    const worker = this.workerFactory();
    const workerId = this.workers.size;

    worker.setCallback(this.onMessage);
    this.workers.set(workerId, worker);
    this.workerQueue.push(worker);
  }

  private fireWorker(workerId: number) {
    const worker = this.workers.get(workerId);

    if (worker) {
      worker.invalidate();
      this.workers.delete(workerId);
      this.workerQueue.splice(this.workerQueue.indexOf(worker), 1);
    }
  }
}
