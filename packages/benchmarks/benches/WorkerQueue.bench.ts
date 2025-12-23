// import { existsSync } from "node:fs";
// import { dirname, join } from "node:path";
// import { fileURLToPath } from "node:url";
// import { SimpleWorkerWrapper, WorkerQueue } from "@mandelbrot/common";
// import { Bench } from "tinybench";
// import WebWorker from "web-worker";
//
// // Determine worker path - prefer built JS, fallback to TS (may not work)
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);
// const builtWorkerPath = join(__dirname, "../dist/worker_queue/BenchmarkWorker.worker.js");
// const sourceWorkerPath = join(__dirname, "../worker_queue/BenchmarkWorker.worker.ts");
//
// if (existsSync(builtWorkerPath)) {
//   // Use built JavaScript file
//   workerPath = builtWorkerPath;
// } else {
//   // Try TypeScript file (may not work with web-worker)
//   console.warn(
//     "Warning: Using TypeScript worker file. Build workers first with 'pnpm build:workers' for better compatibility."
//   );
//   workerPath = sourceWorkerPath;
// }
//
// // Get worker factory - creates real Web Workers
// const getWorker = (): Worker => {
//   // In Node.js with web-worker, we need to provide the worker file
//   // The worker file will be loaded and executed in a separate thread
//   return new WorkerClass(workerPath, { type: "module" }) as Worker;
// };
//
// const bench = new Bench({ time: 1000 });
//
// // Helper to create a worker queue for benchmarking
// async function benchmarkWorkerQueue(
//   poolSize: number,
//   batchSize: number,
//   jobCount: number,
//   fibonacciNumber: number
// ): Promise<void> {
//   const results = new Map<string, number>();
//   let completedJobs = 0;
//   let resolvePromise: () => void;
//
//   const promise = new Promise<void>((resolve) => {
//     resolvePromise = resolve;
//   });
//
//   const queue = new WorkerQueue<number, number>(
//     () => new SimpleWorkerWrapper<number, number>(getWorker()),
//     (jobId, result) => {
//       results.set(jobId, result);
//       completedJobs++;
//       if (completedJobs === jobCount) {
//         // Clean up workers
//         queue.reconfigure({ poolSize: 0, batchSize: 1, requeueWhenRemaning: 0 });
//         resolvePromise();
//       }
//     },
//     {
//       poolSize,
//       batchSize,
//       requeueWhenRemaning: 0,
//     }
//   );
//
//   // Create jobs
//   const jobs = Array.from({ length: jobCount }, (_, i) => ({
//     jobId: `job-${i}`,
//     data: fibonacciNumber,
//   }));
//
//   queue.setJobs(jobs);
//
//   return promise;
// }
//
// // Benchmark: Small pool, small batches
// bench.add("WorkerQueue - 2 workers, batch 5, 100 jobs (fib 30)", async () => {
//   await benchmarkWorkerQueue(2, 5, 100, 30);
// });
//
// // Benchmark: Medium pool, medium batches
// bench.add("WorkerQueue - 4 workers, batch 10, 200 jobs (fib 30)", async () => {
//   await benchmarkWorkerQueue(4, 10, 200, 30);
// });
//
// // Benchmark: Large pool, large batches
// bench.add("WorkerQueue - 8 workers, batch 20, 500 jobs (fib 30)", async () => {
//   await benchmarkWorkerQueue(8, 20, 500, 30);
// });
//
// // Benchmark: Many small jobs
// bench.add("WorkerQueue - 4 workers, batch 1, 1000 jobs (fib 25)", async () => {
//   await benchmarkWorkerQueue(4, 1, 1000, 25);
// });
//
// // Benchmark: Few large jobs
// bench.add("WorkerQueue - 2 workers, batch 50, 100 jobs (fib 35)", async () => {
//   await benchmarkWorkerQueue(2, 50, 100, 35);
// });
//
// // Benchmark: Throughput test
// bench.add("WorkerQueue - 8 workers, batch 25, 1000 jobs (fib 28)", async () => {
//   await benchmarkWorkerQueue(8, 25, 1000, 28);
// });
//
// await bench.run();
//
// console.table(bench.table());
