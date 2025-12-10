import { Bench } from "tinybench";
import Cache from "../cache";

const bench = new Bench({ time: 500 });

// Helper to generate keys
const generateKeys = (count: number, prefix = "key"): string[] => {
  return Array.from({ length: count }, (_, i) => `${prefix}${i}`);
};

// Helper to generate values
const generateValues = (count: number): number[] => {
  return Array.from({ length: count }, (_, i) => i);
};

// Realistic use case: push thousands, tick, push thousands, tick, etc.
bench.add("push 5k → tick → push 5k → tick (10 cycles)", () => {
  const cache = new Cache<number>({ capacity: 5000, minTtl: 10 });
  const keys1 = generateKeys(5000, "batch1");
  const keys2 = generateKeys(5000, "batch2");
  const values = generateValues(5000);

  for (let cycle = 0; cycle < 10; cycle++) {
    // Push 5k items
    for (let i = 0; i < keys1.length; i++) {
      cache.push(keys1[i]!, values[i]!);
    }
    // Tick
    cache.tick();
    // Push 5k more items
    for (let i = 0; i < keys2.length; i++) {
      cache.push(keys2[i]!, values[i]!);
    }
    // Tick
    cache.tick();
  }
});

bench.add("push 10k → tick → push 10k → tick (10 cycles)", () => {
  const cache = new Cache<number>({ capacity: 10000, minTtl: 20 });
  const keys1 = generateKeys(10000, "batch1");
  const keys2 = generateKeys(10000, "batch2");
  const values = generateValues(10000);

  for (let cycle = 0; cycle < 10; cycle++) {
    // Push 10k items
    for (let i = 0; i < keys1.length; i++) {
      cache.push(keys1[i]!, values[i]!);
    }
    // Tick
    cache.tick();
    // Push 10k more items
    for (let i = 0; i < keys2.length; i++) {
      cache.push(keys2[i]!, values[i]!);
    }
    // Tick
    cache.tick();
  }
});

bench.add("push 20k → tick → push 20k → tick (10 cycles)", () => {
  const cache = new Cache<number>({ capacity: 20000, minTtl: 30 });
  const keys1 = generateKeys(20000, "batch1");
  const keys2 = generateKeys(20000, "batch2");
  const values = generateValues(20000);

  for (let cycle = 0; cycle < 10; cycle++) {
    // Push 20k items
    for (let i = 0; i < keys1.length; i++) {
      cache.push(keys1[i]!, values[i]!);
    }
    // Tick
    cache.tick();
    // Push 20k more items
    for (let i = 0; i < keys2.length; i++) {
      cache.push(keys2[i]!, values[i]!);
    }
    // Tick
    cache.tick();
  }
});

bench.add("push 50k → tick → push 50k → tick (5 cycles)", () => {
  const cache = new Cache<number>({ capacity: 50000, minTtl: 50 });
  const keys1 = generateKeys(50000, "batch1");
  const keys2 = generateKeys(50000, "batch2");
  const values = generateValues(50000);

  for (let cycle = 0; cycle < 5; cycle++) {
    // Push 50k items
    for (let i = 0; i < keys1.length; i++) {
      cache.push(keys1[i]!, values[i]!);
    }
    // Tick
    cache.tick();
    // Push 50k more items
    for (let i = 0; i < keys2.length; i++) {
      cache.push(keys2[i]!, values[i]!);
    }
    // Tick
    cache.tick();
  }
});

// Variant: different batch sizes
bench.add("push 5k → tick → push 10k → tick (10 cycles)", () => {
  const cache = new Cache<number>({ capacity: 10000, minTtl: 20 });
  const keys1 = generateKeys(5000, "batch1");
  const keys2 = generateKeys(10000, "batch2");
  const values1 = generateValues(5000);
  const values2 = generateValues(10000);

  for (let cycle = 0; cycle < 10; cycle++) {
    // Push 5k items
    for (let i = 0; i < keys1.length; i++) {
      cache.push(keys1[i]!, values1[i]!);
    }
    // Tick
    cache.tick();
    // Push 10k items
    for (let i = 0; i < keys2.length; i++) {
      cache.push(keys2[i]!, values2[i]!);
    }
    // Tick
    cache.tick();
  }
});

// Variant: with updates (some tiles get updated)
bench.add("push 10k → tick → update 1k → push 10k → tick (10 cycles)", () => {
  const cache = new Cache<number>({ capacity: 15000, minTtl: 20 });
  const keys1 = generateKeys(10000, "batch1");
  const keys2 = generateKeys(10000, "batch2");
  const updateKeys = generateKeys(1000, "update");
  const values = generateValues(10000);
  const updateValues = generateValues(1000);

  for (let cycle = 0; cycle < 10; cycle++) {
    // Push 10k items
    for (let i = 0; i < keys1.length; i++) {
      cache.push(keys1[i]!, values[i]!);
    }
    // Tick
    cache.tick();
    // Update 1k items
    for (let i = 0; i < updateKeys.length; i++) {
      cache.push(updateKeys[i]!, updateValues[i]! + 10000);
    }
    // Push 10k more items
    for (let i = 0; i < keys2.length; i++) {
      cache.push(keys2[i]!, values[i]!);
    }
    // Tick
    cache.tick();
  }
});

// Variant: many small batches
bench.add("push 1k → tick (100 cycles)", () => {
  const cache = new Cache<number>({ capacity: 5000, minTtl: 10 });
  const keys = generateKeys(1000);
  const values = generateValues(1000);

  for (let cycle = 0; cycle < 100; cycle++) {
    // Push 1k items
    for (let i = 0; i < keys.length; i++) {
      cache.push(`${keys[i]!}_${cycle}`, values[i]!);
    }
    // Tick
    cache.tick();
  }
});

// Variant: with reads between pushes
bench.add("push 10k → get 5k → tick → push 10k → get 5k → tick (10 cycles)", () => {
  const cache = new Cache<number>({ capacity: 15000, minTtl: 20 });
  const keys1 = generateKeys(10000, "batch1");
  const keys2 = generateKeys(10000, "batch2");
  const readKeys = generateKeys(5000, "read");
  const values = generateValues(10000);

  for (let cycle = 0; cycle < 10; cycle++) {
    // Push 10k items
    for (let i = 0; i < keys1.length; i++) {
      cache.push(keys1[i]!, values[i]!);
    }
    // Read 5k items
    for (let i = 0; i < readKeys.length; i++) {
      cache.get(readKeys[i]!);
    }
    // Tick
    cache.tick();
    // Push 10k more items
    for (let i = 0; i < keys2.length; i++) {
      cache.push(keys2[i]!, values[i]!);
    }
    // Read 5k items
    for (let i = 0; i < readKeys.length; i++) {
      cache.get(readKeys[i]!);
    }
    // Tick
    cache.tick();
  }
});

// Get operations - cache hits
bench.add("get - 50k cache hits (5k items)", () => {
  const cache = new Cache<number>({ capacity: 2000, minTtl: 100 });
  const keys = generateKeys(5000);
  const values = generateValues(5000);

  // Fill cache
  for (let i = 0; i < keys.length; i++) {
    cache.push(keys[i]!, values[i]!);
  }

  // Read 50k times (each key 10 times)
  for (let round = 0; round < 10; round++) {
    for (let i = 0; i < keys.length; i++) {
      cache.get(keys[i]!);
    }
  }
});

bench.add("get - 100k cache hits (10k items)", () => {
  const cache = new Cache<number>({ capacity: 5000, minTtl: 200 });
  const keys = generateKeys(10000);
  const values = generateValues(10000);

  // Fill cache
  for (let i = 0; i < keys.length; i++) {
    cache.push(keys[i]!, values[i]!);
  }

  // Read 100k times (each key 10 times)
  for (let round = 0; round < 10; round++) {
    for (let i = 0; i < keys.length; i++) {
      cache.get(keys[i]!);
    }
  }
});

// Get operations - cache misses
bench.add("get - 10k cache misses", () => {
  const cache = new Cache<number>({ capacity: 2000, minTtl: 100 });
  const keys = generateKeys(5000);
  const missingKeys = generateKeys(10000, "missing");

  // Fill cache with some items
  for (let i = 0; i < keys.length; i++) {
    cache.push(keys[i]!, i);
  }

  // Read missing keys
  for (let i = 0; i < missingKeys.length; i++) {
    cache.get(missingKeys[i]!);
  }
});

bench.add("get - 50k cache misses", () => {
  const cache = new Cache<number>({ capacity: 5000, minTtl: 200 });
  const keys = generateKeys(10000);
  const missingKeys = generateKeys(50000, "missing");

  // Fill cache with some items
  for (let i = 0; i < keys.length; i++) {
    cache.push(keys[i]!, i);
  }

  // Read missing keys
  for (let i = 0; i < missingKeys.length; i++) {
    cache.get(missingKeys[i]!);
  }
});

await bench.run();

console.table(bench.table());
