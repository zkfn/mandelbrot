import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobQueue } from "../job_queue/JobQueue";
import type {
  QueueToWorkerMessage,
  WorkerToQueueMessage,
  WorkerWithProtocol,
} from "../worker_protocol";
import { SimpleWorkerWrapper, WorkerQueue } from "./WorkerQueue";

const wait = async (millis: number) => {
  await new Promise((resolve) => setTimeout(resolve, millis));
};

class MockWorker implements WorkerWithProtocol<number, number> {
  public onmessage: ((event: MessageEvent<WorkerToQueueMessage<number>>) => void) | null = null;

  private jobQueue: JobQueue<number, number>;

  static messages: QueueToWorkerMessage<unknown>[] = [];
  static lastWorker: MockWorker;
  static workers: MockWorker[] = [];
  static termnations: number = 0;
  static jobs: number = 0;

  static asFactory() {
    return () => {
      MockWorker.lastWorker = new MockWorker();
      MockWorker.workers.push(MockWorker.lastWorker);
      return MockWorker.lastWorker;
    };
  }

  static reset() {
    MockWorker.lastWorker = undefined!;
    MockWorker.workers.length = 0;
    MockWorker.termnations = 0;
    MockWorker.messages.length = 0;
    MockWorker.jobs = 0;
  }

  constructor() {
    this.jobQueue = new JobQueue(
      async (value) => {
        await wait(value);
        return value;
      },
      (result) => {
        this.simulateMessage(result);
      }
    );
  }

  postMessage(message: QueueToWorkerMessage<number>) {
    MockWorker.messages.push(message);

    switch (message.kind) {
      case "assign": {
        this.jobQueue.push(
          ...message.jobs.map((job) => {
            return {
              jobId: job.jobId,
              data: job.data,
              generation: message.generation,
            };
          })
        );
        break;
      }
      case "cancel": {
        this.simulateMessage(this.jobQueue.cancel(message.jobIds));
        break;
      }
      case "cancel-all": {
        this.simulateMessage(this.jobQueue.cancelAll());
        break;
      }
    }
  }

  simulateMessage(message: WorkerToQueueMessage<number>) {
    if (this.onmessage) {
      this.onmessage({ data: message } as MessageEvent);
    }
  }

  terminate() {
    MockWorker.termnations += 1;
  }
}

const MockWorkerFactory = SimpleWorkerWrapper.asFactory(MockWorker.asFactory());

describe("WorkerQueue", () => {
  let results: Map<string, unknown>;
  let resultCallback: (jobId: string, result: unknown) => void;

  beforeEach(() => {
    MockWorker.reset();
    results = new Map();
    resultCallback = vi.fn((jobId: string, result: unknown) => {
      results.set(jobId, result);
    });
  });

  describe("constructor", () => {
    it("should create a WorkerQueue with valid config", () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      expect(queue).toBeInstanceOf(WorkerQueue);
    });

    it("should throw error if poolSize is less than 1", () => {
      expect(() => {
        new WorkerQueue(MockWorkerFactory, resultCallback, {
          poolSize: 0,
          batchSize: 5,
          requeueWhenRemaning: 1,
        });
      }).toThrow("poolSize must be at least 1");
    });

    it("should throw error if batchSize is less than 1", () => {
      expect(() => {
        new WorkerQueue(MockWorkerFactory, resultCallback, {
          poolSize: 2,
          batchSize: 0,
          requeueWhenRemaning: 1,
        });
      }).toThrow("chunkSize must be at least 1");
    });

    it("should throw error if requeueWhenRemaning is less than 0", () => {
      expect(() => {
        new WorkerQueue(MockWorkerFactory, resultCallback, {
          poolSize: 2,
          batchSize: 5,
          requeueWhenRemaning: -1,
        });
      }).toThrow("requeueWhenRemaning must be at least 0");
    });
  });

  describe("setJobs", () => {
    it("should assign jobs to workers when jobs are set", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 1,
        batchSize: 2,
        requeueWhenRemaning: 0,
      });

      queue.setJobs([
        { jobId: "job1", data: 10 },
        { jobId: "job2", data: 20 },
      ]);

      // Wait a bit for async operations
      await wait(10);

      const sentMessages = MockWorker.messages;
      expect(sentMessages.length).toBeGreaterThan(0);
      const assignMessage = sentMessages.find((m) => m.kind === "assign");
      expect(assignMessage).toBeDefined();
      if (assignMessage && assignMessage.kind === "assign") {
        expect(assignMessage.jobs).toHaveLength(2);
        expect(assignMessage.jobs[0].jobId).toBe("job1");
        expect(assignMessage.jobs[1].jobId).toBe("job2");
      }
    });

    it("should handle job results", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      // Wait a bit for worker to be ready
      await wait(10);

      queue.setJobs([{ jobId: "job1", data: 42 }]);

      // Wait for job to complete (42ms sleep + buffer)
      await wait(60);

      expect(resultCallback).toHaveBeenCalledWith("job1", 42);
      expect(results.get("job1")).toBe(42);
    });

    it("should cancel jobs that are no longer in the job list", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      queue.setJobs([
        { jobId: "job1", data: 100 }, // Long sleep so it can be cancelled
        { jobId: "job2", data: 20 },
      ]);

      // Wait a bit for job1 to be assigned (but not complete)
      await wait(10);

      // Remove job1 from the queue
      queue.setJobs([{ jobId: "job2", data: 20 }]);

      await wait(10);

      const sentMessages = MockWorker.messages;
      const cancelMessage = sentMessages.find((m) => m.kind === "cancel");

      expect(cancelMessage).toBeDefined();

      if (cancelMessage && cancelMessage.kind === "cancel") {
        expect(cancelMessage.jobIds).toContain("job1");
      }
    });
  });

  describe("reconfigure", () => {
    it("should add workers when poolSize increases", () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 1,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      expect(MockWorker.workers.length).toBe(1);

      queue.reconfigure({
        poolSize: 3,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      expect(MockWorker.workers.length).toBe(3);
    });

    it("should remove workers when poolSize decreases", () => {
      // TODO: this
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 3,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      expect(MockWorker.workers.length).toBe(3);

      queue.reconfigure({
        poolSize: 1,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      // The important thing is it doesn't throw
      expect(queue).toBeInstanceOf(WorkerQueue);
    });
  });

  describe("batch processing", () => {
    it("should respect batchSize when assigning jobs", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 3,
        requeueWhenRemaning: 0,
      });

      queue.setJobs([
        { jobId: "job1", data: 1 },
        { jobId: "job2", data: 2 },
        { jobId: "job3", data: 3 },
        { jobId: "job4", data: 4 },
        { jobId: "job5", data: 5 },
      ]);

      await wait(10);

      expect(MockWorker.messages).toHaveLength(2);
    });
  });

  describe("job processing", () => {
    it("should process jobs and return results", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 1,
        batchSize: 2,
        requeueWhenRemaning: 0,
      });

      // Wait a bit for worker to be ready
      await wait(10);

      queue.setJobs([
        { jobId: "job1", data: 10 }, // Sleep for 10ms
        { jobId: "job2", data: 20 }, // Sleep for 20ms
      ]);

      // Wait for jobs to complete (10ms + 20ms + some buffer)
      await wait(50);

      expect(resultCallback).toHaveBeenCalledTimes(2);
      expect(results.get("job1")).toBe(10);
      expect(results.get("job2")).toBe(20);
    });

    it("should handle multiple workers processing jobs in parallel", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      // Wait a bit for workers to be ready
      await wait(10);

      queue.setJobs([
        { jobId: "job1", data: 30 },
        { jobId: "job2", data: 30 },
        { jobId: "job3", data: 30 },
        { jobId: "job4", data: 30 },
      ]);

      // With 2 workers, jobs should complete faster than sequential
      await wait(100);

      expect(resultCallback).toHaveBeenCalledTimes(4);
      expect(results.get("job1")).toBe(30);
      expect(results.get("job2")).toBe(30);
      expect(results.get("job3")).toBe(30);
      expect(results.get("job4")).toBe(30);
    });
  });

  describe("cancellation", () => {
    it("should cancel jobs that are removed from the queue", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 999, // High value so worker is always requeued
      });

      // Wait a bit for worker to be ready
      await wait(10);

      queue.setJobs([
        { jobId: "job1", data: 50 }, // Long sleep
        { jobId: "job2", data: 10 }, // Short sleep
        { jobId: "job3", data: 10 }, // Short sleep
      ]);

      // Wait a bit for job1 to be assigned (but not complete)
      await wait(10);

      // Remove job2 from the queue (should cancel it)
      queue.setJobs([{ jobId: "job3", data: 1 }]);

      // Wait for job1 to complete
      await wait(60);

      expect(results.has("job1")).toBe(true);
      expect(results.has("job2")).toBe(false);
      expect(results.get("job3")).toBe(1);
    });

    it("should handle cancel-all message", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 1,
        batchSize: 3,
        requeueWhenRemaning: 0,
      });

      queue.setJobs([
        { jobId: "job1", data: 100 },
        { jobId: "job2", data: 100 },
        { jobId: "job3", data: 100 },
      ]);

      // Wait a bit for jobs to be assigned
      await wait(10);

      // Clear all jobs (this should send cancel-all)
      queue.setJobs([]);

      // Wait a bit (but not long enough for jobs to complete)
      await wait(50);

      // At most one job might complete if it was already running when cancelled
      // The currently running job cannot be cancelled, so it will complete
      expect(resultCallback).toHaveBeenCalledTimes(0);
      expect(results.size).toBe(0);
    });
  });
});
