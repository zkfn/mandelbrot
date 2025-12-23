import type { CancelledMessage, JobPayloadWithGeneration, ResultMessage } from "../worker_protocol";

type Runner<TData, TResult> = (data: TData) => Promise<TResult>;
type Callback<TResult> = (result: ResultMessage<TResult>) => void;

export class JobQueue<TData, TResult> {
  private runner: Runner<TData, TResult>;
  private callback: Callback<TResult>;
  private jobs: JobPayloadWithGeneration<TData>[];
  private waiting: boolean;

  private runningJobGeneration: number;
  private runningJobId: string;

  public constructor(runner: Runner<TData, TResult>, callback: Callback<TResult>) {
    this.runner = runner;
    this.callback = callback;
    this.waiting = false;
    this.jobs = [];

    this.runningJobGeneration = null!;
    this.runningJobId = null!;
    this.run();
  }

  public queuedJobs() {
    return this.jobs.length;
  }

  private run() {
    const nextJob = this.jobs.shift();

    if (nextJob === undefined) {
      this.waiting = true;
      this.runningJobGeneration = null!;
      this.runningJobId = null!;

      return;
    } else {
      this.waiting = false;
    }

    const { generation, jobId, data } = nextJob;

    this.runningJobId = jobId;
    this.runningJobGeneration = generation;

    this.runner(data).then(this.onJobDone);
  }

  private onJobDone = (result: TResult) => {
    this.callback({
      kind: "result",
      remainingJobs: this.jobs.length,
      data: result,
      jobId: this.runningJobId,
      generation: this.runningJobGeneration,
    });

    this.run();
  };

  public push(...jobs: JobPayloadWithGeneration<TData>[]) {
    this.jobs.push(...jobs);

    if (this.waiting) {
      this.run();
    }
  }

  public cancel(jobIds: string[]): CancelledMessage {
    const cancelled: string[] = [];

    this.jobs = this.jobs.filter((job) => {
      if (jobIds.includes(job.jobId)) {
        cancelled.push(job.jobId);
        return false;
      } else {
        return true;
      }
    });

    let remainingJobs = this.jobs.length;

    if (!this.waiting) {
      remainingJobs += 1;
    }

    return {
      kind: "cancelled",
      remainingJobs,
      jobIds: cancelled,
    };
  }

  public cancelAll(): CancelledMessage {
    const jobIds = this.jobs.map((job) => job.jobId);
    this.jobs.length = 0;

    return {
      kind: "cancelled",
      jobIds,
      remainingJobs: this.waiting ? 0 : 1,
    };
  }
}
