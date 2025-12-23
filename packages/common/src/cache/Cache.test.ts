import { beforeEach, describe, expect, it } from "vitest";
import { Cache } from ".";

describe("Cache", () => {
  describe("constructor", () => {
    it("should initialize with valid config", () => {
      const cache = new Cache<string>({
        capacity: 10,
        minTtl: 5,
      });

      expect(cache).toBeInstanceOf(Cache);
      expect(cache.size()).toBe(0);
    });

    it("should throw error if minTtl is less than 1", () => {
      expect(() => {
        new Cache<string>({
          capacity: 10,
          minTtl: 0,
        });
      }).toThrow("minTtl must be at least 1");

      expect(() => {
        new Cache<string>({
          capacity: 10,
          minTtl: -1,
        });
      }).toThrow("minTtl must be at least 1");
    });
  });

  describe("push", () => {
    let cache: Cache<string>;

    beforeEach(() => {
      cache = new Cache<string>({
        capacity: 10,
        minTtl: 5,
      });
    });

    it("should add new items to cache", () => {
      cache.push("key1", "value1");
      cache.push("key2", "value2");
      cache.push("key3", "value3");

      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBe("value2");
      expect(cache.get("key3")).toBe("value3");
      expect(cache.size()).toBe(3);
    });

    it("should update existing item without increasing size", () => {
      cache.push("key1", "value1");
      expect(cache.size()).toBe(1);

      cache.push("key1", "value1-updated");
      expect(cache.get("key1")).toBe("value1-updated");
      expect(cache.size()).toBe(1);
    });

    it("should move updated item to newest generation and prevent pruning", () => {
      const cache = new Cache<string>({
        capacity: 3,
        minTtl: 3,
      });

      // Add multiple items
      cache.push("old1", "value1");
      cache.push("old2", "value2");
      cache.push("old3", "value3");
      cache.push("old4", "value4");

      // Advance time to move items to older generations
      cache.tick(); // Generation 1
      cache.tick(); // Generation 2

      // Update one of the old items - should move it to generation 0
      cache.push("old2", "value2-updated");

      // Advance time beyond minTtl to trigger pruning
      for (let i = 0; i < 4; i++) {
        cache.tick();
      }

      // The updated item should remain, others should be pruned
      expect(cache.get("old1")).toBeUndefined();
      expect(cache.get("old2")).toBe("value2-updated");
      expect(cache.get("old3")).toBeUndefined();
      expect(cache.get("old4")).toBeUndefined();
      expect(cache.size()).toBe(1);
    });
  });

  describe("get", () => {
    let cache: Cache<number>;

    beforeEach(() => {
      cache = new Cache<number>({
        capacity: 10,
        minTtl: 5,
      });
    });

    it("should return value for existing key", () => {
      cache.push("key1", 42);
      expect(cache.get("key1")).toBe(42);
    });

    it("should return undefined for non-existent key", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should return updated value after push", () => {
      cache.push("key1", 10);
      expect(cache.get("key1")).toBe(10);

      cache.push("key1", 20);
      expect(cache.get("key1")).toBe(20);
    });
  });

  describe("size", () => {
    let cache: Cache<string>;

    beforeEach(() => {
      cache = new Cache<string>({
        capacity: 10,
        minTtl: 5,
      });
    });

    it("should return 0 for empty cache", () => {
      expect(cache.size()).toBe(0);
    });

    it("should return correct count after adding items", () => {
      cache.push("key1", "value1");
      expect(cache.size()).toBe(1);

      cache.push("key2", "value2");
      expect(cache.size()).toBe(2);
    });
  });

  describe("tick", () => {
    let cache: Cache<string>;

    beforeEach(() => {
      cache = new Cache<string>({
        capacity: 10,
        minTtl: 5,
      });
    });

    it("should advance time without pruning items within minTtl", () => {
      cache.push("key1", "value1");
      cache.push("key2", "value2");

      // Advance time but stay within minTtl
      for (let i = 0; i < 4; i++) {
        cache.tick();
      }

      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBe("value2");
      expect(cache.size()).toBe(2);
    });

    it("should prune old items when capacity exceeded and minTtl passed", () => {
      // Fill cache beyond capacity
      for (let i = 0; i < 15; i++) {
        cache.push(`key${i}`, `value${i}`);
      }

      expect(cache.size()).toBe(15);

      // Advance time beyond minTtl to trigger pruning
      for (let i = 0; i < 6; i++) {
        cache.tick();
      }

      // All items are in the same old generation, so they all get pruned
      expect(cache.size()).toBe(0);

      // Add new items gradually to verify capacity limit works
      for (let i = 0; i < 10; i++) {
        cache.push(`new${i}`, `value${i}`);
        cache.tick(); // Advance time to create generations
      }

      // Add more items to exceed capacity
      for (let i = 10; i < 15; i++) {
        cache.push(`new${i}`, `value${i}`);
      }

      // Advance time to trigger pruning
      for (let i = 0; i < 6; i++) {
        cache.tick();
      }

      // Should be pruned down to capacity
      expect(cache.size()).toBeLessThanOrEqual(10);
    });

    it("should prune oldest items first", () => {
      const cache = new Cache<string>({
        capacity: 3,
        minTtl: 2,
      });

      cache.push("old1", "value1");
      cache.push("old2", "value2");
      cache.tick(); // Move to generation 1

      cache.push("new1", "value3");
      cache.push("new2", "value4");
      cache.push("new3", "value5");

      expect(cache.size()).toBe(5);

      // Advance time to trigger pruning
      for (let i = 0; i < 3; i++) {
        cache.tick();
      }

      // Old items should be pruned, new items should remain
      expect(cache.get("old1")).toBeUndefined();
      expect(cache.get("old2")).toBeUndefined();
      expect(cache.get("new1")).toBe("value3");
      expect(cache.get("new2")).toBe("value4");
      expect(cache.get("new3")).toBe("value5");
      expect(cache.size()).toBe(3);
    });
  });

  describe("reconfigure", () => {
    it("should update capacity and minTtl", () => {
      const cache = new Cache<string>({
        capacity: 10,
        minTtl: 5,
      });

      cache.reconfigure({
        capacity: 20,
        minTtl: 10,
      });

      // Verify by checking behavior
      for (let i = 0; i < 25; i++) {
        cache.push(`key${i}`, `value${i}`);
      }

      expect(cache.size()).toBe(25);
    });

    it("should update capacity when reconfigured", () => {
      const cache = new Cache<string>({
        capacity: 10,
        minTtl: 3,
      });

      // Fill cache with items
      for (let i = 0; i < 10; i++) {
        cache.push(`key${i}`, `value${i}`);
      }

      expect(cache.size()).toBe(10);

      // Reduce capacity
      cache.reconfigure({
        capacity: 5,
        minTtl: 3,
      });

      // Items are still in generation 0, so they don't get pruned yet
      expect(cache.size()).toBe(10);

      // Advance time to trigger pruning with new capacity
      for (let i = 0; i < 4; i++) {
        cache.tick();
      }

      // Should be pruned down to new capacity
      expect(cache.size()).toBe(0);
    });

    it("should prune items when minTtl is reduced and items exceed capacity", () => {
      const cache = new Cache<string>({
        capacity: 5,
        minTtl: 10,
      });

      // Fill cache beyond capacity
      for (let i = 0; i < 8; i++) {
        cache.push(`key${i}`, `value${i}`);
      }

      expect(cache.size()).toBe(8);

      // Advance time but not enough to prune with minTtl=10
      for (let i = 0; i < 5; i++) {
        cache.tick();
      }

      // Items are still within minTtl=10, so they don't get pruned yet
      // Reduce minTtl - should allow pruning of older items
      cache.reconfigure({
        capacity: 5,
        minTtl: 3,
      });

      // All items are old enough (generation 5 > minTtl 3), so they get pruned
      expect(cache.size()).toBe(0);
    });

    it("should throw error if minTtl is less than 1", () => {
      const cache = new Cache<string>({
        capacity: 10,
        minTtl: 5,
      });

      expect(() => {
        cache.reconfigure({
          capacity: 10,
          minTtl: 0,
        });
      }).toThrow("minTtl must be at least 1");
    });
  });

  describe("edge cases", () => {
    it("should handle empty cache", () => {
      const cache = new Cache<string>({
        capacity: 10,
        minTtl: 5,
      });

      expect(cache.size()).toBe(0);

      for (let i = 0; i < 10; i++) {
        cache.tick();
      }

      expect(cache.size()).toBe(0);
    });

    it("should handle single item", () => {
      const cache = new Cache<string>({
        capacity: 10,
        minTtl: 5,
      });

      cache.push("key1", "value1");
      expect(cache.size()).toBe(1);
      expect(cache.get("key1")).toBe("value1");

      for (let i = 0; i < 10; i++) {
        cache.tick();
      }

      expect(cache.size()).toBe(1);
      expect(cache.get("key1")).toBe("value1");
    });

    it("should handle capacity of 1", () => {
      const cache = new Cache<string>({
        capacity: 1,
        minTtl: 2,
      });

      cache.push("key1", "value1");
      cache.push("key2", "value2");

      expect(cache.size()).toBe(2);

      for (let i = 0; i < 3; i++) {
        cache.tick();
      }

      // Both items are in the same old generation, so they both get pruned
      expect(cache.size()).toBe(0);
    });

    it("should handle minTtl of 1", () => {
      const cache = new Cache<string>({
        capacity: 5,
        minTtl: 1,
      });

      for (let i = 0; i < 10; i++) {
        cache.push(`key${i}`, `value${i}`);
      }

      expect(cache.size()).toBe(10);

      cache.tick();

      // All items are in the same old generation, so they all get pruned
      expect(cache.size()).toBe(0);
    });
  });

  describe("generic type support", () => {
    it("should work with number type", () => {
      const cache = new Cache<number>({
        capacity: 10,
        minTtl: 5,
      });

      cache.push("key1", 42);
      cache.push("key2", 100);

      expect(cache.get("key1")).toBe(42);
      expect(cache.get("key2")).toBe(100);
      expect(cache.size()).toBe(2);
    });

    it("should work with object type", () => {
      interface TestData {
        id: number;
        name: string;
      }

      const cache = new Cache<TestData>({
        capacity: 10,
        minTtl: 5,
      });

      cache.push("key1", { id: 1, name: "test" });
      cache.push("key2", { id: 2, name: "test2" });

      expect(cache.get("key1")).toEqual({ id: 1, name: "test" });
      expect(cache.get("key2")).toEqual({ id: 2, name: "test2" });
      expect(cache.size()).toBe(2);
    });

    it("should work with array type", () => {
      const cache = new Cache<number[]>({
        capacity: 10,
        minTtl: 5,
      });

      cache.push("key1", [1, 2, 3]);
      cache.push("key2", [4, 5, 6]);

      expect(cache.get("key1")).toEqual([1, 2, 3]);
      expect(cache.get("key2")).toEqual([4, 5, 6]);
      expect(cache.size()).toBe(2);
    });
  });
});
