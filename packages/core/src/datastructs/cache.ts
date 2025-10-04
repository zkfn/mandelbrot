import { assert, assertGtZero } from "@mandelbrot/common/asserts";

export type CacheProps = {
	/**
	 * If there is more items then this, the oldest items are deleted, however
	 * they must reach at least the `minAge`.
	 */
	maxCapacity: number;

	/**
	 * The items in the cache must reach at least this age to be eligible for
	 * deletion. The value must be > 0.
	 */
	minAge: number;

	/**
	 * Items that reach this age will be deleted. In case the value is less
	 * than `minAge` items are deleted only based on capacity (`maxAge` is
	 * ignored).
	 */
	maxAge: number;
};

const defaultProps: CacheProps = {
	minAge: 10,
	maxAge: -1,
	maxCapacity: 10000,
};

export default class Cache<Value> {
	private maxCapacity: number;
	private minAge: number;
	private maxAge: number;

	private items: Map<string, Value>;
	private ageGroups: Array<Set<string>>;
	private itemAges: { [key: string]: number };
	private rememberedItems: number;

	public constructor(props: Partial<CacheProps>) {
		const {
			maxAge = defaultProps.maxAge,
			minAge = defaultProps.minAge,
			maxCapacity = defaultProps.maxCapacity,
		} = props;

		assertGtZero(minAge, "Minimum age must be positive integer.");

		this.maxCapacity = maxCapacity;
		this.maxAge = maxAge;
		this.minAge = minAge;

		this.items = new Map();
		this.ageGroups = [new Set()];
		this.itemAges = {};
		this.rememberedItems = 0;
	}

	/**
	 * Touching an item resets its age. In case the item touched was no longer
	 * cached, returns `false` (the call does not fail, but the item will not
	 * be obtainable by subsequent `get` calls). If the item is still in cache
	 * returns `true`.
	 */
	public touch(key: string): boolean {
		if (key in this.itemAges) {
			this.itemAges[key] = 0;
			this.removeFromAgeGroups([key]);
			this.ageGroups[0].add(key);
			return true;
		} else {
			return false;
		}
	}

	/**
	 * If the key is already in use, rewrite its value and touch it. Otherwise
	 * inserts and sets the keys age to 0.
	 */
	public insert(key: string, value: Value): void {
		if (!this.touch(key)) {
			this.itemAges[key] = 0;
			this.ageGroups[0].add(key);
			this.rememberedItems += 1;
		}

		this.items.set(key, value);
	}

	public has(key: string): boolean {
		return this.items.has(key);
	}

	public get(key: string): Value | undefined {
		return this.items.get(key);
	}

	public size(): number {
		return this.rememberedItems;
	}

	public getAsserted(key: string): Value {
		assert(this.items.has(key), `Key assertion failed: ${key}`);
		return this.items.get(key)!;
	}

	/** Completely clears the cache*/
	public clear(): void {
		this.items.clear();
		this.itemAges = {};
		this.rememberedItems = 0;

		this.ageGroups.length = 0;
		this.ageGroups.unshift(new Set());
	}

	public setCapacity(capacity: number): void {
		this.maxCapacity = capacity;
		this.pruneOldAndExtraItems();
	}

	public setMaxAge(age: number): void {
		this.maxAge = age;
		this.pruneOldAndExtraItems();
	}

	public setMinAge(age: number): void {
		assertGtZero(age);
		this.minAge = age;
		this.pruneOldAndExtraItems();
	}

	/**
	 * Advance all item ages by 1. Items that go over the age/capacity limit
	 * will be pruned at the end of the call. Optionally you can pass keys that
	 * should be touched before the prune happens.
	 */
	public tick(...keysTouched: string[]): void {
		for (const key in this.itemAges) {
			this.itemAges[key] += 1;
		}

		for (const key in keysTouched) {
			assert(key in this.itemAges, `Touched key is not in cache: ${key}`);
			this.itemAges[key] = 0;
		}

		this.removeFromAgeGroups(keysTouched);

		// Create new age group for the youngest elements
		this.ageGroups.unshift(new Set(keysTouched));

		this.pruneOldAndExtraItems();
	}

	private removeFromAgeGroups(keys: string[]) {
		this.ageGroups.forEach((group) => keys.forEach((key) => group.delete(key)));
	}

	private pruneOldAndExtraItems() {
		while (this.shouldPopOldestGroup()) {
			const oldestGroup = this.ageGroups.pop();
			assert(oldestGroup !== undefined);

			this.rememberedItems -= oldestGroup.size;

			oldestGroup.forEach((key) => {
				delete this.itemAges[key];
				this.items.delete(key);
			});
		}
	}

	private shouldPopOldestGroup(): boolean {
		if (this.isAGroupTooOld()) return true;
		if (this.isOldEnough()) return this.isOverLimit();
		else return false;
	}

	private isAGroupTooOld(): boolean {
		if (this.maxAge <= this.minAge) return false;
		return this.ageGroups.length >= this.maxAge;
	}

	private isOverLimit(): boolean {
		return this.rememberedItems > this.maxCapacity;
	}

	private isOldEnough(): boolean {
		return this.ageGroups.length >= this.minAge;
	}
}
