import { Bench } from "tinybench";
import { helloFromCommon } from "../index.js";

const bench = new Bench({ time: 100 });

bench
  .add("helloFromCommon", () => {
    helloFromCommon();
  })
  .add("string concatenation", () => {
    const a = "Hello";
    const b = " from common!";
    return a + b;
  });

await bench.run();

console.table(bench.table());
