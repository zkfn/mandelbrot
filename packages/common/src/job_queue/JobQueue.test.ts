import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResultMessage } from "../worker_protocol";
import { JobQueue } from "./JobQueue";

const wait = async (millis: number) => {
  await new Promise((resolve) => setTimeout(resolve, millis));
};

const sleepRunner = vi.fn(async (data: { sleepMs: number; value: number }) => {
  await wait(data.sleepMs);
  return data.value;
});

describe("JobQueue", () => {
  let results: ResultMessage<unknown>[];
  let callback: (result: ResultMessage<unknown>) => void;

  beforeEach(() => {
    results = [];
    sleepRunner.mockClear();
    callback = vi.fn((result: ResultMessage<unknown>) => {
      results.push(result);
    });
  });

  describe("constructor", () => {
    it("should create a JobQueue and start processing", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      queue.push({ jobId: "job1", data: { sleepMs: 10, value: 5 }, generation: 0 });

      await wait(30);

      expect(sleepRunner).toHaveBeenCalledTimes(1);
      expect(sleepRunner).toHaveBeenCalledWith({ sleepMs: 10, value: 5 });
      expect(callback).toHaveBeenCalledTimes(1);
      expect(results[0]).toEqual({
        kind: "result",
        jobId: "job1",
        generation: 0,
        data: 5,
        remainingJobs: 0,
      });
    });
  });

  describe("push", () => {
    it("should process jobs sequentially", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(20);

      queue.push({ jobId: "job1", data: { sleepMs: 5, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 5, value: 2 }, generation: 0 });
      queue.push({ jobId: "job3", data: { sleepMs: 5, value: 3 }, generation: 0 });

      await wait(50);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        kind: "result",
        jobId: "job1",
        generation: 0,
        data: 1,
        remainingJobs: 2,
      });
      expect(results[1]).toEqual({
        kind: "result",
        jobId: "job2",
        generation: 0,
        data: 2,
        remainingJobs: 1,
      });
      expect(results[2]).toEqual({
        kind: "result",
        jobId: "job3",
        generation: 0,
        data: 3,
        remainingJobs: 0,
      });
    });

    it("should resume processing when job is pushed while waiting", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      // Push first job
      queue.push({ jobId: "job1", data: { sleepMs: 10, value: 1 }, generation: 0 });

      // Wait for it to complete and queue to be empty
      await wait(30);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(results[0]).toEqual({
        kind: "result",
        jobId: "job1",
        generation: 0,
        data: 1,
        remainingJobs: 0,
      });

      // Push another job - should resume processing
      queue.push({ jobId: "job2", data: { sleepMs: 10, value: 2 }, generation: 0 });

      await wait(30);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(results[1]).toEqual({
        kind: "result",
        jobId: "job2",
        generation: 0,
        data: 2,
        remainingJobs: 0,
      });
    });

    it("should handle multiple jobs queued before processing starts", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      // Push multiple jobs before any processing
      queue.push({ jobId: "job1", data: { sleepMs: 10, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 10, value: 2 }, generation: 0 });
      queue.push({ jobId: "job3", data: { sleepMs: 10, value: 3 }, generation: 0 });

      await wait(50);

      expect(sleepRunner).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
    });
  });

  describe("callback", () => {
    it("should call callback with correct jobId, generation, and result", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job-123", data: { sleepMs: 10, value: 42 }, generation: 5 });

      await wait(30);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(results[0]).toEqual({
        kind: "result",
        jobId: "job-123",
        generation: 5,
        data: 42,
        remainingJobs: 0,
      });
    });

    it("should preserve generation across job processing", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 10, value: 1 }, generation: 10 });
      queue.push({ jobId: "job2", data: { sleepMs: 10, value: 2 }, generation: 20 });
      queue.push({ jobId: "job3", data: { sleepMs: 10, value: 3 }, generation: 30 });

      await wait(50);

      expect(results).toHaveLength(3);
      expect(results[0].generation).toBe(10);
      expect(results[1].generation).toBe(20);
      expect(results[2].generation).toBe(30);
    });

    it("should include remainingJobs in callback", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 10, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 10, value: 2 }, generation: 0 });
      queue.push({ jobId: "job3", data: { sleepMs: 10, value: 3 }, generation: 0 });

      await wait(50);

      expect(results).toHaveLength(3);
      // First job completes with 2 remaining
      expect(results[0].remainingJobs).toBe(2);
      // Second job completes with 1 remaining
      expect(results[1].remainingJobs).toBe(1);
      // Last job completes with 0 remaining
      expect(results[2].remainingJobs).toBe(0);
    });
  });

  describe("cancel", () => {
    it("should cancel queued jobs by jobId", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 20, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 20, value: 2 }, generation: 0 });
      queue.push({ jobId: "job3", data: { sleepMs: 20, value: 3 }, generation: 0 });

      // Cancel job2 before it starts processing
      // Wait a bit to ensure job1 has started
      await wait(10);
      queue.cancel(["job2"]);

      await wait(80);

      // Only job1 and job3 should be processed
      expect(sleepRunner).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(results[0].jobId).toBe("job1");
      expect(results[1].jobId).toBe("job3");
      expect(results.find((r) => r.jobId === "job2")).toBeUndefined();
    });

    it("should return CancelledMessage with cancelled jobIds and remainingJobs", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 20, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 20, value: 2 }, generation: 0 });
      queue.push({ jobId: "job3", data: { sleepMs: 20, value: 3 }, generation: 0 });

      // Wait a bit to ensure job1 has started
      await wait(10);

      const cancelledMessage = queue.cancel(["job2"]);

      expect(cancelledMessage).toEqual({
        kind: "cancelled",
        jobIds: ["job2"],
        remainingJobs: 2, // job1 running + job3 queued
      });
    });

    it("should return empty jobIds array when cancelling non-existent jobs", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 10, value: 1 }, generation: 0 });

      const cancelledMessage = queue.cancel(["non-existent"]);

      expect(cancelledMessage).toEqual({
        kind: "cancelled",
        jobIds: [],
        remainingJobs: 1, // job1 is running
      });
    });

    it("should cancel multiple jobs", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 20, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 20, value: 2 }, generation: 0 });
      queue.push({ jobId: "job3", data: { sleepMs: 20, value: 3 }, generation: 0 });
      queue.push({ jobId: "job4", data: { sleepMs: 20, value: 4 }, generation: 0 });

      // Wait a bit to ensure job1 has started
      await wait(10);
      queue.cancel(["job2", "job4"]);

      await wait(80);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(results[0].jobId).toBe("job1");
      expect(results[1].jobId).toBe("job3");
    });

    it("should not cancel currently running job", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 50, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 20, value: 2 }, generation: 0 });

      // Wait a bit for job1 to start
      await wait(10);

      // Try to cancel job1 (should not work as it's running)
      queue.cancel(["job1"]);

      await wait(100);

      // job1 should still complete
      expect(callback).toHaveBeenCalledTimes(2);
      expect(results[0].jobId).toBe("job1");
      expect(results[1].jobId).toBe("job2");
    });

    it("should handle cancelling non-existent jobIds", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 10, value: 1 }, generation: 0 });

      // Cancel a job that doesn't exist
      queue.cancel(["non-existent"]);

      await wait(30);

      // job1 should still be processed
      expect(callback).toHaveBeenCalledTimes(1);
      expect(results[0].jobId).toBe("job1");
    });
  });

  describe("cancelAll", () => {
    it("should cancel all queued jobs", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 20, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 20, value: 2 }, generation: 0 });
      queue.push({ jobId: "job3", data: { sleepMs: 20, value: 3 }, generation: 0 });

      // Wait a bit to ensure job1 has started
      await wait(10);
      queue.cancelAll();

      await wait(50);

      // Only the first job (if it started) should complete
      // The rest should be cancelled
      expect(callback).toHaveBeenCalledTimes(1);
      expect(results[0].jobId).toBe("job1");
    });

    it("should not cancel currently running job", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 50, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 20, value: 2 }, generation: 0 });
      queue.push({ jobId: "job3", data: { sleepMs: 20, value: 3 }, generation: 0 });

      // Wait for job1 to start
      await wait(10);

      queue.cancelAll();

      await wait(100);

      // job1 should complete (it was running)
      // job2 and job3 should be cancelled
      expect(callback).toHaveBeenCalledTimes(1);
      expect(results[0].jobId).toBe("job1");
    });

    it("should return CancelledMessage with all queued jobIds when cancelling all", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 20, value: 1 }, generation: 0 });
      queue.push({ jobId: "job2", data: { sleepMs: 20, value: 2 }, generation: 0 });
      queue.push({ jobId: "job3", data: { sleepMs: 20, value: 3 }, generation: 0 });

      // Wait a bit to ensure job1 has started (it's no longer in the queue)
      await wait(10);

      const cancelledMessage = queue.cancelAll();

      // Only queued jobs (job2 and job3) are cancelled, job1 is running
      expect(cancelledMessage).toEqual({
        kind: "cancelled",
        jobIds: ["job2", "job3"],
        remainingJobs: 1, // job1 is running
      });
    });

    it("should return remainingJobs 0 when cancelling all while waiting", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push({ jobId: "job1", data: { sleepMs: 10, value: 1 }, generation: 0 });

      // Wait for job1 to complete
      await wait(30);

      // Now queue should be waiting
      const cancelledMessage = queue.cancelAll();

      expect(cancelledMessage).toEqual({
        kind: "cancelled",
        jobIds: [],
        remainingJobs: 0,
      });
    });
  });

  describe("queuedJobs", () => {
    it("should return the number of queued jobs", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      expect(queue.queuedJobs()).toBe(0);

      queue.push({ jobId: "job1", data: { sleepMs: 20, value: 1 }, generation: 0 });
      expect(queue.queuedJobs()).toBe(0); // job1 starts immediately, so queue is empty

      queue.push({ jobId: "job2", data: { sleepMs: 20, value: 2 }, generation: 0 });
      expect(queue.queuedJobs()).toBe(1); // job2 is queued

      queue.push({ jobId: "job3", data: { sleepMs: 20, value: 3 }, generation: 0 });
      expect(queue.queuedJobs()).toBe(2); // job2 and job3 are queued

      await wait(100);
    });

    it("should return 0 when queue is empty and waiting", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      expect(queue.queuedJobs()).toBe(0);

      queue.push({ jobId: "job1", data: { sleepMs: 10, value: 1 }, generation: 0 });

      // Wait for job to complete
      await wait(30);

      expect(queue.queuedJobs()).toBe(0);
    });
  });

  describe("push with multiple jobs", () => {
    it("should accept multiple jobs as variadic arguments", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push(
        { jobId: "job1", data: { sleepMs: 10, value: 1 }, generation: 0 },
        { jobId: "job2", data: { sleepMs: 10, value: 2 }, generation: 0 },
        { jobId: "job3", data: { sleepMs: 10, value: 3 }, generation: 0 }
      );

      await wait(50);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(results[0].jobId).toBe("job1");
      expect(results[1].jobId).toBe("job2");
      expect(results[2].jobId).toBe("job3");
    });

    it("should process multiple pushed jobs sequentially", async () => {
      const queue = new JobQueue(sleepRunner, callback);

      await wait(10);

      queue.push(
        { jobId: "job1", data: { sleepMs: 20, value: 1 }, generation: 0 },
        { jobId: "job2", data: { sleepMs: 20, value: 2 }, generation: 0 }
      );

      // First job should complete (20ms sleep + buffer)
      await wait(40);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(results[0].jobId).toBe("job1");
      expect(results[0].remainingJobs).toBe(1); // job2 is still queued

      // Second job should complete (20ms sleep + buffer)
      await wait(40);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(results[1].jobId).toBe("job2");
      expect(results[1].remainingJobs).toBe(0); // no more jobs
    });
  });
});
