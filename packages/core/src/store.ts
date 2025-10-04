import type { TileId, WithTileId } from "@mandelbrot/common";
import { DisposeFlag } from "@mandelbrot/common";

export enum TileState {
	QUEUED,
	RENDERING,
	READY,
}

type TileRecordWithoutPayload = {
	state: TileState.QUEUED | TileState.RENDERING;
};

type TileRecordWithPayload<Payload extends WithTileId> = {
	state: TileState.READY;
	payload: Payload;
};

export type TileRecord<Payload extends WithTileId> =
	| TileRecordWithoutPayload
	| TileRecordWithPayload<Payload>;

class TimeWheel<Key extends string | number | symbol> {
	private slots: Array<Set<Key>>;
	private ages: Map<Key, number>;
	private rememberedItems: number;

	/** Value 0 (or less) means there is no max age */
	public maxAge: number;

	public minAge: number;
	public maxItems: number;

	public constructor(maxItems: number, minAge: number, maxAge: number) {
		this.minAge = minAge;
		this.maxAge = maxAge;
		this.maxItems = maxItems;

		this.ages = new Map();
		this.slots = [new Set()];
		this.rememberedItems = 0;
	}

	public touch(key: Key): void {
		const age = this.ages.get(key);

		if (age == undefined) {
			this.rememberedItems += 1;
		} else {
			this.slots[age].delete(key);
		}

		this.ages.set(key, 0);
		this.slots[0].add(key);
	}

	public tick(): void {
		for (const [key, age] of this.ages) {
			this.ages.set(key, age + 1);
		}

		this.slots.unshift(new Set());
	}

	public clear(): void {
		this.rememberedItems = 0;
		this.slots.length = 0;
		this.slots.push(new Set());
		this.ages.clear();
	}

	public prune(): Key[] {
		const pruned: Key[] = [];

		while (this.shouldPop()) {
			const poped = this.slots.pop()!;
			this.rememberedItems -= poped.size;

			for (const key of poped) {
				this.ages.delete(key);
			}

			pruned.push(...poped);
		}

		return pruned;
	}

	public size(): number {
		return this.rememberedItems;
	}

	private shouldPop(): boolean {
		if (this.isTooOld()) return true;
		if (this.isOldEnough()) return this.isOverLimit();
		else return false;
	}

	private isTooOld(): boolean {
		if (this.maxAge <= 0) return false;
		return this.slots.length >= this.maxAge;
	}

	private isOverLimit(): boolean {
		return this.rememberedItems > this.maxItems;
	}

	private isOldEnough(): boolean {
		return this.slots.length >= this.minAge;
	}
}

export interface TileStoreProps {
	minAge: number;
	maxAge: number;
	capacity: number;
}

export class TileStore<Payload extends WithTileId> {
	private readonly tiles: Map<TileId, TileRecord<Payload>>;
	private readonly timeWheel: TimeWheel<TileId>;
	private readonly disposeFlag: DisposeFlag;

	public constructor(props: Partial<TileStoreProps>) {
		const { minAge = 5, maxAge = 0, capacity = 5000 } = props;

		this.tiles = new Map();
		this.timeWheel = new TimeWheel(capacity, minAge, maxAge);
		this.disposeFlag = new DisposeFlag();
	}

	public setMaxAge(maxAge: number): void {
		this.disposeFlag.assertNotDisposed();
		this.timeWheel.maxAge = maxAge;
		this.prune();
	}

	public setMaxSize(maxSize: number): void {
		this.disposeFlag.assertNotDisposed();
		this.timeWheel.maxItems = maxSize;
		this.prune();
	}

	public prune(): void {
		this.disposeFlag.assertNotDisposed();

		for (const tileId of this.timeWheel.prune()) {
			this.tiles.delete(tileId);
		}
	}

	public clear(): void {
		this.disposeFlag.assertNotDisposed();

		this.tiles.clear();
		this.timeWheel.clear();
	}

	public dispose(): void {
		this.disposeFlag.assertNotDisposed();
		this.disposeFlag.set();

		this.tiles.clear();
		this.timeWheel.clear();
	}

	public size(): number {
		return this.timeWheel.size();
	}

	public getTile(tileId: TileId): TileRecord<Payload> | undefined {
		this.disposeFlag.assertNotDisposed();
		return this.tiles.get(tileId);
	}

	public setQueued(tileId: TileId): void {
		this.disposeFlag.assertNotDisposed();

		const record = this.tiles.get(tileId);

		if (!record) {
			this.tiles.set(tileId, { state: TileState.QUEUED });
		} else if (record.state != TileState.QUEUED) {
			throw new Error(`Enqueueing a tile that is in the store: ${tileId}.`);
		}
	}

	public setRendering(tileId: TileId): void {
		this.disposeFlag.assertNotDisposed();

		const tile = this.tiles.get(tileId);

		if (!tile) {
			throw new Error(`Rendering a tile that is not in the store: ${tileId}.`);
		} else if (tile.state != TileState.QUEUED) {
			throw new Error(`Rendering a tile that is not enqueued: ${tileId}.`);
		} else {
			tile.state = TileState.RENDERING;
		}
	}

	public setReady(tileId: TileId, payload: Payload): void {
		this.disposeFlag.assertNotDisposed();

		const tile = this.tiles.get(tileId);

		if (!tile) {
			throw new Error(`Readying a tile that is not in the store: ${tileId}.`);
		} else if (tile.state != TileState.RENDERING) {
			throw new Error(`Readying a tile that is not rendering: ${tileId}.`);
		} else {
			this.timeWheel.touch(tileId);
			this.tiles.set(tileId, {
				state: TileState.READY,
				payload,
			});
		}
	}

	public resetFailedTileToQueue(tileIds: TileId[]): void {
		this.disposeFlag.assertNotDisposed();

		tileIds.forEach((tileId) => {
			const tile = this.tiles.get(tileId);

			if (!tile) {
				throw new Error(`Reseting a tile that is not in the store: ${tileId}.`);
			} else if (tile.state != TileState.RENDERING) {
				throw new Error(`Reseting a tile that is not rendering: ${tileId}.`);
			} else {
				this.tiles.set(tileId, { state: TileState.QUEUED });
			}
		});
	}
}
