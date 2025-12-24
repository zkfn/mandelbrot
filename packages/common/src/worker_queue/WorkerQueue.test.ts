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
  private assignedJobs: Map<string, number> = new Map(); // jobId -> generation

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
        this.assignedJobs.delete(result.jobId);
        this.simulateMessage(result);
      }
    );
  }

  postMessage(message: QueueToWorkerMessage<number>) {
    MockWorker.messages.push(message);

    switch (message.kind) {
      case "assign": {
        for (const job of message.jobs) {
          this.assignedJobs.set(job.jobId, message.generation);
        }
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
        for (const jobId of message.jobIds) {
          this.assignedJobs.delete(jobId);
        }
        this.simulateMessage(this.jobQueue.cancel(message.jobIds));
        break;
      }
      case "terminate": {
        MockWorker.termnations += 1;
        const terminated = this.jobQueue.terminate();
        this.simulateMessage(terminated);
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
    const newResults = new Map();
    results = newResults;
    resultCallback = vi.fn((jobId: string, result: unknown) => {
      newResults.set(jobId, result);
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

    it("should send terminate message to surplus workers when poolSize decreases", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 3,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(10);
      expect(MockWorker.workers.length).toBe(3);

      queue.reconfigure({
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(20);

      // Workers with id >= 1 should receive terminate messages
      const terminateMessages = MockWorker.messages.filter((m) => m.kind === "terminate");
      expect(terminateMessages.length).toBe(2);
      expect(MockWorker.termnations).toBe(2);
    });

    it("should reassign jobs from terminated workers to remaining workers", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 2,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      // Assign jobs to both workers
      queue.setJobs([
        { jobId: "job1", data: 100 },
        { jobId: "job2", data: 100 },
        { jobId: "job3", data: 100 },
        { jobId: "job4", data: 100 },
        { jobId: "job5", data: 100 },
        { jobId: "job6", data: 100 },
      ]);

      await wait(10);

      // Get initial assign message count
      const initialAssignCount = MockWorker.messages.filter((m) => m.kind === "assign").length;
      expect(initialAssignCount).toBe(2);

      // Two jobs per worker, leaving two in the queue
      expect(queue.queuedJobs()).toBe(2);

      // Reduce pool size - worker 1 should be terminated
      queue.reconfigure({
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      const terminateMessages = MockWorker.messages.filter((m) => m.kind === "terminate");
      expect(terminateMessages.length).toBe(1);

      await wait(10);

      // Two assigned to worker 0, one finished by worker 1, one returned to the queue
      expect(queue.queuedJobs()).toBe(3);
    });

    it("should let terminated workers finish current computation before removing them", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      // Assign a job to worker 1 that will complete quickly
      queue.setJobs([
        { jobId: "job1", data: 10 }, // Short sleep - assigned to worker 0 or 1
      ]);

      await wait(10);

      // Reduce pool size while job is running
      // The worker processing the job should be terminated, but should finish the job
      queue.reconfigure({
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      // Wait for job to complete (10ms sleep + buffer)
      await wait(30);

      // The job should complete even though the worker was terminated
      // This verifies that terminated workers finish their current computation
      expect(results.has("job1")).toBe(true);
      expect(results.get("job1")).toBe(10);
    });

    it("should preserve workers when poolSize decreases then increases", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 3,
        requeueWhenRemaning: 0,
      });

      await wait(10);
      const initialWorkers = [...MockWorker.workers];
      expect(initialWorkers.length).toBe(2);

      queue.setJobs([
        { jobId: "job1", data: 40 },
        { jobId: "job2", data: 10 },
        { jobId: "job3", data: 10 },
        { jobId: "job4", data: 40 },
        { jobId: "job5", data: 10 },
        { jobId: "job6", data: 10 },
        { jobId: "job7", data: 10 },
        { jobId: "job8", data: 10 },
        { jobId: "job9", data: 10 },
        { jobId: "job10", data: 10 },
      ]);

      // Reduce pool size
      queue.reconfigure({
        poolSize: 1,
        batchSize: 3,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      const terminateMessages = MockWorker.messages.filter((m) => m.kind === "terminate");

      expect(terminateMessages.length).toBe(1);
      await wait(10);

      // Increase pool size back
      queue.reconfigure({
        poolSize: 2,
        batchSize: 3,
        requeueWhenRemaning: 0,
      });

      await wait(100);

      expect(MockWorker.workers.length).toBe(2);
      expect(results.size).toBe(10);
    });

    it("should recreate workers when poolSize decreases then increases with enough time", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 3,
        requeueWhenRemaning: 0,
      });

      await wait(10);
      const initialWorkers = [...MockWorker.workers];
      expect(initialWorkers.length).toBe(2);

      queue.setJobs([
        { jobId: "job1", data: 40 },
        { jobId: "job2", data: 10 },
        { jobId: "job3", data: 10 },
        { jobId: "job4", data: 40 },
        { jobId: "job5", data: 10 },
        { jobId: "job6", data: 10 },
        { jobId: "job7", data: 10 },
        { jobId: "job8", data: 10 },
        { jobId: "job9", data: 10 },
        { jobId: "job10", data: 10 },
      ]);

      // Reduce pool size
      queue.reconfigure({
        poolSize: 1,
        batchSize: 3,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      const terminateMessages = MockWorker.messages.filter((m) => m.kind === "terminate");

      expect(terminateMessages.length).toBe(1);

      await wait(40);

      // Increase pool size back
      queue.reconfigure({
        poolSize: 2,
        batchSize: 3,
        requeueWhenRemaning: 0,
      });

      await wait(100);

      expect(MockWorker.workers.length).toBe(3);
      expect(results.size).toBe(10);
    });

    it("should handle concurrent resize and setJobs", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      // Concurrently resize and set jobs
      queue.reconfigure({
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      queue.setJobs([
        { jobId: "job1", data: 10 },
        { jobId: "job2", data: 10 },
      ]);

      await wait(50);

      // All jobs should complete
      expect(resultCallback).toHaveBeenCalledTimes(2);
      expect(results.get("job1")).toBe(10);
      expect(results.get("job2")).toBe(10);
    });

    it("should handle multiple resize operations in quick succession", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 3,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      // Rapid resize operations
      queue.reconfigure({
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(5);

      queue.reconfigure({
        poolSize: 2,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(5);

      queue.reconfigure({
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      // Should not throw and should have correct number of workers
      expect(MockWorker.workers.length).toBeGreaterThanOrEqual(1);
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

    it("should handle terminate message", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 1,
        batchSize: 3,
        requeueWhenRemaning: 0,
      });

      queue.setJobs([
        { jobId: "job1", data: 50 },
        { jobId: "job2", data: 100 },
        { jobId: "job3", data: 100 },
      ]);

      // Wait a bit for jobs to be assigned
      await wait(10);

      // Clear all jobs (this should send cancel-all)
      queue.setJobs([]);

      // Wait a bit (but not long enough for jobs to complete)
      await wait(60);

      // At most one job might complete if it was already running when cancelled
      // The currently running job cannot be cancelled, so it will complete
      expect(resultCallback).toHaveBeenCalledTimes(1);
      expect(results.size).toBe(1);
    });
  });

  describe("destroy", () => {
    it("should mark the queue as destroyed", () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      expect(queue.isDestroyed()).toBe(false);
      queue.destroy();
      expect(queue.isDestroyed()).toBe(true);
    });

    it("should kill all workers when destroyed", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 3,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      await wait(10);
      expect(MockWorker.workers.length).toBe(3);

      const initialTerminations = MockWorker.termnations;
      queue.destroy();

      // All workers should be killed (terminate() called)
      expect(MockWorker.termnations).toBe(initialTerminations + 3);
    });

    it("should throw error when calling reconfigure after destroy", () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      queue.destroy();

      expect(() => {
        queue.reconfigure({
          poolSize: 3,
          batchSize: 5,
          requeueWhenRemaning: 1,
        });
      }).toThrow("Cannot call method 'reconfigure' on destroyed object");
    });

    it("should throw error when calling setJobs after destroy", () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      queue.destroy();

      expect(() => {
        queue.setJobs([{ jobId: "job1", data: 10 }]);
      }).toThrow("Cannot call method 'setJobs' on destroyed object");
    });

    it("should throw error when calling queuedJobs after destroy", () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      queue.destroy();

      expect(() => {
        queue.queuedJobs();
      }).toThrow("Cannot call method 'queuedJobs' on destroyed object");
    });

    it("should allow destroy to be called multiple times without error", () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 5,
        requeueWhenRemaning: 1,
      });

      queue.destroy();
      expect(queue.isDestroyed()).toBe(true);

      // Should not throw when called again
      expect(() => {
        queue.destroy();
      }).not.toThrow();

      expect(queue.isDestroyed()).toBe(true);
    });

    it("should prevent operations after destroy even if jobs were previously set", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 1,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      queue.setJobs([
        { jobId: "job1", data: 10 },
        { jobId: "job2", data: 20 },
      ]);

      await wait(10);

      queue.destroy();

      // All operations should fail after destroy
      expect(() => {
        queue.reconfigure({
          poolSize: 2,
          batchSize: 1,
          requeueWhenRemaning: 0,
        });
      }).toThrow("Cannot call method 'reconfigure' on destroyed object");

      expect(() => {
        queue.setJobs([{ jobId: "job3", data: 30 }]);
      }).toThrow("Cannot call method 'setJobs' on destroyed object");

      expect(() => {
        queue.queuedJobs();
      }).toThrow("Cannot call method 'queuedJobs' on destroyed object");
    });

    it("should kill workers even if they have pending jobs", async () => {
      const queue = new WorkerQueue(MockWorkerFactory, resultCallback, {
        poolSize: 2,
        batchSize: 1,
        requeueWhenRemaning: 0,
      });

      await wait(10);

      queue.setJobs([
        { jobId: "job1", data: 100 }, // Long sleep
        { jobId: "job2", data: 100 }, // Long sleep
      ]);

      await wait(10);

      const initialTerminations = MockWorker.termnations;
      queue.destroy();

      // All workers should be killed immediately
      expect(MockWorker.termnations).toBe(initialTerminations + 2);
    });
  });
});
