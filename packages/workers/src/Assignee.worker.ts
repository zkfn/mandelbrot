import type { QueueToWorkerMessage } from "@mandelbrot/common/worker-protocol";

export class Assignee<TData> {
  private jobQueue: { generation: number; jobId: string; job: TData }[];

  public constructor() {
    this.jobQueue = [];
    self.onmessage = this.onMessage;
  }

  protected onMessage = (event: MessageEvent<QueueToWorkerMessage<TData>>) => {
    console.log(event.data);

    switch (event.data.kind) {
      case "assign": {
        const { generation, jobs } = event.data;

        this.jobQueue.push(
          ...jobs.map(({ jobId, data }) => {
            return {
              jobId,
              job: data,
              generation,
            };
          })
        );

        break;
      }

      default: {
        console.error(`Cannot handle ${event.data.kind}`);
      }
    }
  };
}
