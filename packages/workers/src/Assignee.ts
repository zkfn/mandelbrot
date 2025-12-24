import { JobQueue } from "@mandelbrot/common/";
import type { QueueToWorkerMessage, ResultMessage } from "@mandelbrot/common/worker-protocol";

export abstract class Assignee<TData, TResult> {
  private jobQueue: JobQueue<TData, TResult>;

  public constructor() {
    this.jobQueue = new JobQueue(this.run, this.onResult);
    self.onmessage = this.onMessage;
  }

  abstract run(data: TData): Promise<TResult>;

  protected onResult(result: ResultMessage<TResult>): void {
    self.postMessage(result);
  }

  protected onMessage = (event: MessageEvent<QueueToWorkerMessage<TData>>) => {
    switch (event.data.kind) {
      case "assign": {
        const { generation, jobs } = event.data;

        this.jobQueue.push(
          ...jobs.map(({ jobId, data }) => {
            return {
              jobId,
              data,
              generation,
            };
          })
        );

        break;
      }

      case "cancel": {
        const cancelled = this.jobQueue.cancel(event.data.jobIds);
        self.postMessage(cancelled);
        break;
      }

      case "terminate": {
        const terminated = this.jobQueue.terminate();
        self.postMessage(terminated);
        break;
      }

      default: {
        throw new Error(`Cannot handle ${event.data}`);
      }
    }
  };
}
