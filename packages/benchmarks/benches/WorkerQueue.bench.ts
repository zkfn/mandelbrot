import { SimpleWorkerWrapper, WorkerQueue } from "@mandelbrot/common";
import type { WorkerWithProtocol } from "@mandelbrot/common/worker-protocol";
import { Bench } from "tinybench";
import Worker from "web-worker";

const workerPath = import.meta.resolve("@mandelbrot/workers/FibWorker");
const bench = new Bench({
  time: 0,
  iterations: 1,
  warmupIterations: 0, // Disable warmup runs to avoid repeated executions
  warmupTime: 0, // Disable warmup time
});

// Separate metrics container
const metrics = new Map<string, { totalTime: number; throughput: number }>();

// Generate normal distribution using Box-Muller transform
let spare: number | null = null;
let hasSpare = false;

function generateNormal(mean: number, stdDev: number): number {
  if (hasSpare) {
    hasSpare = false;
    return spare! * stdDev + mean;
  }

  hasSpare = true;
  const u1 = Math.random();
  const u2 = Math.random();
  const mag = stdDev * Math.sqrt(-2.0 * Math.log(u1));
  spare = Math.cos(2.0 * Math.PI * u2) * mag;
  return Math.sin(2.0 * Math.PI * u2) * mag + mean;
}

// Generate fibonacci input numbers (n values for fib(n))
// Mean and stdDev now represent the fibonacci index, not duration
function generateJobs(count: number, mean: number, stdDev: number) {
  const fibIndices = Array.from({ length: count }, () => {
    const index = generateNormal(mean, stdDev);
    // Clamp to reasonable range: fibonacci indices between 25-30
    // fib(25) ~0.9ms, fib(30) ~8.4ms - more consistent timing
    // Higher values (35+) take 95ms+ and cause timeouts
    return Math.max(25, Math.min(30, Math.round(index)));
  });

  return fibIndices.map((fibIndex, index) => ({
    jobId: `job-${index}`,
    data: fibIndex,
  }));
}

// Create worker factory using FibWorker
const createWorkerFactory = (): ((id: number) => SimpleWorkerWrapper<number, number>) => {
  return SimpleWorkerWrapper.asFactory<number, number>(() => {
    const worker = new Worker(workerPath, { type: "module" });
    return worker as WorkerWithProtocol<number, number>;
  });
};

// Helper to wait for all jobs to complete
async function waitForCompletion(
  result: { finished: number },
  expectedResults: number,
  timeout = 120000, // Increased to 120 seconds
  label = "benchmark"
): Promise<void> {
  const startTime = Date.now();
  let lastLogged = 0;
  const logInterval = 5000; // Log every 5 seconds

  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const finished = result.finished;
      const progress = ((finished / expectedResults) * 100).toFixed(1);

      // Log progress every 5 seconds
      if (elapsed - lastLogged >= logInterval) {
        console.log(
          `[${label}] Progress: ${finished}/${expectedResults} (${progress}%) - ${(elapsed / 1000).toFixed(1)}s elapsed`
        );
        lastLogged = elapsed;
      }

      if (finished >= expectedResults) {
        clearInterval(checkInterval);
        const totalTime = Date.now() - startTime;
        console.log(
          `[${label}] Completed: ${finished}/${expectedResults} in ${(totalTime / 1000).toFixed(2)}s`
        );
        resolve();
      } else if (elapsed > timeout) {
        clearInterval(checkInterval);
        reject(
          new Error(
            `[${label}] Timeout waiting for completion. Got ${finished}/${expectedResults} after ${(elapsed / 1000).toFixed(2)}s`
          )
        );
      }
    }, 10);
  });
}

const scaling = () => {
  const jobs = generateJobs(600, 30, 5);
  const batchSize = 5;
  const requeueWhenRemaining = 2;
  const poolSizes = [1, 2, 4, 8, 16];

  for (const poolSize of poolSizes) {
    bench.add(
      `Scaling: pool=${poolSize}, batch=${batchSize}, requeue=${requeueWhenRemaining}, jobs=${jobs.length}`,
      async () => {
        const startTime = performance.now();
        const result = { finished: 0 };
        // Create a fresh worker factory for each benchmark
        const workerFactory = createWorkerFactory();
        const queue = new WorkerQueue(
          workerFactory,
          () => {
            result.finished++;
          },
          {
            poolSize,
            batchSize,
            requeueWhenRemaning: requeueWhenRemaining,
          }
        );

        // Small delay to ensure workers are initialized
        await new Promise((resolve) => setTimeout(resolve, 50));

        const benchLabel = `Scaling: pool=${poolSize}`;
        console.log(`[${benchLabel}] Starting with ${jobs.length} jobs`);
        queue.setJobs(jobs);
        await waitForCompletion(result, jobs.length, 120000, benchLabel);
        const endTime = performance.now();
        queue.destroy();

        const totalTime = endTime - startTime;
        const throughput = (jobs.length / totalTime) * 1000;
        metrics.set(`pool=${poolSize}`, { totalTime, throughput });
      }
    );
  }
};

const requeue = () => {
  const jobs = generateJobs(200, 30, 5);
  const poolSize = 4;
  const batchSize = 10;
  const requeueWhenRemainingValues = [0, 1, 5, 10, 20];

  for (const requeueWhenRemaining of requeueWhenRemainingValues) {
    bench.add(
      `Requeue: pool=${poolSize}, batch=${batchSize}, requeue=${requeueWhenRemaining}, jobs=${jobs.length}`,
      async () => {
        const startTime = performance.now();
        const result = { finished: 0 };
        // Create a fresh worker factory for each benchmark
        const workerFactory = createWorkerFactory();
        const queue = new WorkerQueue(
          workerFactory,
          () => {
            result.finished++;
          },
          {
            poolSize,
            batchSize,
            requeueWhenRemaning: requeueWhenRemaining,
          }
        );

        // Small delay to ensure workers are initialized
        await new Promise((resolve) => setTimeout(resolve, 50));

        const benchLabel = `Requeue: requeue=${requeueWhenRemaining}`;
        console.log(`[${benchLabel}] Starting with ${jobs.length} jobs`);
        queue.setJobs(jobs);
        await waitForCompletion(result, jobs.length, 120000, benchLabel);
        const endTime = performance.now();
        queue.destroy();

        const totalTime = endTime - startTime;
        const throughput = (jobs.length / totalTime) * 1000;
        metrics.set(`requeue=${requeueWhenRemaining}`, { totalTime, throughput });
      }
    );
  }
};

const batch = () => {
  const jobs = generateJobs(200, 30, 5);
  const poolSize = 4;
  const requeueWhenRemaining = 0;
  const batchSizes = [1, 5, 10, 20, 50];

  for (const batchSize of batchSizes) {
    bench.add(
      `Batch: pool=${poolSize}, batch=${batchSize}, requeue=${requeueWhenRemaining}, jobs=${jobs.length}`,
      async () => {
        const startTime = performance.now();
        const result = { finished: 0 };
        // Create a fresh worker factory for each benchmark
        const workerFactory = createWorkerFactory();
        const queue = new WorkerQueue(
          workerFactory,
          () => {
            result.finished++;
          },
          {
            poolSize,
            batchSize,
            requeueWhenRemaning: requeueWhenRemaining,
          }
        );

        // Small delay to ensure workers are initialized
        await new Promise((resolve) => setTimeout(resolve, 50));

        const benchLabel = `Batch: batch=${batchSize}`;
        console.log(`[${benchLabel}] Starting with ${jobs.length} jobs`);
        queue.setJobs(jobs);
        await waitForCompletion(result, jobs.length, 120000, benchLabel);
        const endTime = performance.now();
        queue.destroy();

        const totalTime = endTime - startTime;
        const throughput = (jobs.length / totalTime) * 1000;
        metrics.set(`batch=${batchSize}`, { totalTime, throughput });
      }
    );
  }
};

export async function runWorkerQueueBench(): Promise<void> {
  scaling();
  requeue();
  batch();

  await bench.run();

  // Display comparative results
  console.log("\n=== SCALING: Pool Size Impact ===");
  const scalingMetrics: Array<{
    pool: number;
    time: number;
    throughput: number;
  }> = [];
  const poolSizes = [1, 2, 4, 8, 16];
  for (const poolSize of poolSizes) {
    const metric = metrics.get(`pool=${poolSize}`);
    if (metric) {
      scalingMetrics.push({
        pool: poolSize,
        time: metric.totalTime,
        throughput: metric.throughput,
      });
    }
  }
  console.table(scalingMetrics);
  if (scalingMetrics.length > 0) {
    const baseline = scalingMetrics[0]?.time;
    if (baseline) {
      console.log(
        `Speedup (vs pool=1): ${scalingMetrics
          .map((m) => (baseline / m.time).toFixed(2))
          .join("x, ")}x`
      );
    }
  }

  console.log("\n=== REQUEUE: Requeue Parameter Impact ===");
  const requeueMetrics: Array<{
    requeue: number;
    time: number;
    throughput: number;
  }> = [];
  const requeueWhenRemainingValues = [0, 1, 5, 10, 20];
  for (const requeueWhenRemaining of requeueWhenRemainingValues) {
    const metric = metrics.get(`requeue=${requeueWhenRemaining}`);
    if (metric) {
      requeueMetrics.push({
        requeue: requeueWhenRemaining,
        time: metric.totalTime,
        throughput: metric.throughput,
      });
    }
  }
  console.table(requeueMetrics);

  console.log("\n=== BATCH: Batch Size Impact ===");
  const batchMetrics: Array<{ batch: number; time: number; throughput: number }> = [];
  const batchSizes = [1, 5, 10, 20, 50];
  for (const batchSize of batchSizes) {
    const metric = metrics.get(`batch=${batchSize}`);
    if (metric) {
      batchMetrics.push({
        batch: batchSize,
        time: metric.totalTime,
        throughput: metric.throughput,
      });
    }
  }
  console.table(batchMetrics);

  console.log("\n=== Raw Benchmark Results ===");
  console.table(bench.table());
}
