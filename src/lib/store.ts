import { TileState, type TileId } from "@common/tiles";

export interface TileRecord<Payload = unknown> {
	state: TileState;
	payload?: Payload;
}

class TileTimeWheel {
	private slots: Array<Set<TileId>>;
	private ages: Map<TileId, number>;
	private totalItems: number;
	private readonly maxAge: number;
	private readonly minAge: number;
	private readonly maxItems: number;

	public constructor(maxAge: number, minAge: number, maxItems: number) {
		this.maxAge = maxAge;
		this.minAge = minAge;
		this.maxItems = maxItems;

		this.slots = [new Set()];
		this.ages = new Map();
		this.totalItems = 0;
	}

	public touch(tile: TileId) {
		const age = this.ages.get(tile);

		if (age == undefined) {
			this.totalItems += 1;
		} else {
			this.slots[age].delete(tile);
		}

		this.ages.set(tile, 0);
		this.slots[0].add(tile);
	}

	public tick(): TileId[] {
		for (const [tileId, age] of this.ages) {
			this.ages.set(tileId, age + 1);
		}

		this.slots.unshift(new Set());
		return this.prune();
	}

	public clear() {
		this.ages.clear();
		this.slots.length = 0;
	}

	private prune(): TileId[] {
		const pruned: TileId[] = [];

		while (
			this.slots.length >= this.maxAge ||
			(this.totalItems > this.maxItems && this.slots.length >= this.minAge)
		) {
			pruned.push(...this.popSlot());
		}

		return pruned;
	}

	private popSlot(): Set<TileId> {
		const poped = this.slots.pop()!;
		this.totalItems -= poped.size;

		for (const tileId of poped) {
			this.ages.delete(tileId);
		}

		return poped;
	}
}

export class TileStore<Payload> {
	private tiles: Map<TileId, TileRecord<Payload>>;
	private timeWheel: TileTimeWheel;

	public constructor() {
		this.tiles = new Map();
		this.timeWheel = new TileTimeWheel(1000, 10, 15000);
	}

	public getTileRecord(tileId: TileId): TileRecord<Payload> | undefined {
		return this.tiles.get(tileId);
	}

	public setQueued(tileId: TileId) {
		const tile = this.tiles.get(tileId);

		if (!tile) {
			this.tiles.set(tileId, { state: TileState.QUEUED });
		} else if (tile.state != TileState.QUEUED) {
			throw new Error(`Enqueueing a tile that is in the store: ${tileId}.`);
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
			tile.state = TileState.READY;
			tile.payload = payload;
		}
	}

	public prune() {
		for (const id of this.timeWheel.tick()) {
			this.tiles.delete(id);
		}
	}

	// TODO rename
	public clear() {
		this.tiles.clear();
		this.timeWheel.clear();
	}
}
