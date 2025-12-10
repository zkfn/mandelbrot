type CacheConfig = {
  capacity: number;
  minTtl: number;
};

export default class Cache<TData> {
  private itemCount: number = 0;
  private capacity: number = 0;
  private minTtl: number = 0;

  private items: Map<string, TData>;
  private generations: Map<string, Set<string>>;
  private ttls: Array<Set<string>>;

  public constructor({ capacity, minTtl }: CacheConfig) {
    this.itemCount = 0;
    this.items = new Map();
    this.generations = new Map();
    this.ttls = [new Set()];

    this.reconfigure({ capacity, minTtl });
  }

  public reconfigure({ capacity, minTtl }: CacheConfig) {
    this.capacity = capacity;
    this.minTtl = minTtl;

    if (this.minTtl < 1) {
      throw new Error("minTtl must be at least 1");
    }

    this.prune();
  }

  public push(key: string, value: TData) {
    const oldGeneration = this.generations.get(key);
    const newGeneration = this.ttls[0];

    if (oldGeneration !== undefined) {
      if (oldGeneration !== newGeneration) {
        oldGeneration.delete(key);
        newGeneration.add(key);
        this.generations.set(key, newGeneration);
      }
    } else {
      newGeneration.add(key);
      this.generations.set(key, newGeneration);
      this.itemCount += 1;
    }

    this.items.set(key, value);
  }

  public tick() {
    this.ttls.unshift(new Set());
    this.prune();
  }

  public get(key: string): TData | undefined {
    return this.items.get(key);
  }

  public size(): number {
    return this.itemCount;
  }

  private prune() {
    while (this.ttls.length > this.minTtl && this.itemCount > this.capacity) {
      const oldestGeneration = this.ttls.pop();
      if (oldestGeneration === undefined) {
        break;
      }

      oldestGeneration.forEach((key) => {
        this.items.delete(key);
        this.generations.delete(key);
      });

      this.itemCount -= oldestGeneration.size;
    }
  }
}
