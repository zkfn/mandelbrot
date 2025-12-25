import { runCacheBench } from "./benches/Cache.bench.js";
import { runWorkerQueueBench } from "./benches/WorkerQueue.bench.js";

// Run benchmarks sequentially to avoid influencing worker threads
console.log("Running WorkerQueue benchmarks...");
await runWorkerQueueBench();

console.log("\n\nRunning Cache benchmarks...");
await runCacheBench();
