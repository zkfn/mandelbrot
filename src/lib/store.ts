import { type TileId } from "@common/tiles";
import type { TileJobResult } from "./jobs";

export enum TileState {
	QUEUED,
	RENDERING,
	READY,
}

type TileRecordWithoutPayload = {
	state: TileState.QUEUED | TileState.RENDERING;
};

type TileRecordWithPayload<Payload extends TileJobResult> = {
	state: TileState.READY;
	payload: Payload;
};

export type TileRecord<Payload extends TileJobResult> =
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

	public dispose(): void {
		this.slots.length = 0;
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

export class TileStore<Payload extends TileJobResult> {
	private tiles: Map<TileId, TileRecord<Payload>>;
	private timeWheel: TimeWheel<TileId>;

	public constructor(storeSize: number, minAge: number, maxAge: number = 0) {
		this.tiles = new Map();
		this.timeWheel = new TimeWheel(storeSize, minAge, maxAge);
	}

	public setMaxAge(maxAge: number): void {
		this.timeWheel.maxAge = maxAge;
		this.prune();
	}

	public setMaxSize(maxSize: number): void {
		this.timeWheel.maxItems = maxSize;
		this.prune();
	}

	public prune() {
		for (const tileId of this.timeWheel.prune()) {
			this.tiles.delete(tileId);
		}
	}

	public dispose() {
		this.tiles.clear();
		this.timeWheel.dispose();
	}

	public size(): number {
		return this.timeWheel.size();
	}

	public getTile(tileId: TileId): TileRecord<Payload> | undefined {
		return this.tiles.get(tileId);
	}

	public setQueued(tileId: TileId) {
		const record = this.tiles.get(tileId);

		if (!record) {
			this.tiles.set(tileId, { state: TileState.QUEUED });
		} else if (record.state != TileState.QUEUED) {
			throw new Error(`Enqueueing a tile that is in the store: ${tileId}.`);
		}
	}

	public setRendering(tileId: TileId) {
		const tile = this.tiles.get(tileId);

		if (!tile) {
			throw new Error(`Rendering a tile that is not in the store: ${tileId}.`);
		} else if (tile.state != TileState.QUEUED) {
			throw new Error(`Rendering a tile that is not enqueued: ${tileId}.`);
		} else {
			tile.state = TileState.RENDERING;
		}
	}

	public setReady(tileId: TileId, payload: Payload) {
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

	public resetFailedTileToQueue(tileId: TileId) {
		const tile = this.tiles.get(tileId);

		if (!tile) {
			throw new Error(`Reseting a tile that is not in the store: ${tileId}.`);
		} else if (tile.state != TileState.RENDERING) {
			throw new Error(`Reseting a tile that is not rendering: ${tileId}.`);
		} else {
			this.tiles.set(tileId, { state: TileState.QUEUED });
		}
	}
}
