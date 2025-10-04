import type { TileId, WithTileId } from "@mandelbrot/common";
import { DisposeFlag } from "@mandelbrot/common";
import Cache from "./datastructs/cache";

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

export interface TileStoreProps {
	minAge: number;
	maxAge: number;
	capacity: number;
}

export class TileStore<Payload extends WithTileId> {
	private readonly cache: Cache<Payload>;
	private readonly disposeFlag: DisposeFlag;
	private readonly states: Map<string, TileState>;

	public constructor(props: Partial<TileStoreProps>) {
		this.cache = new Cache(props);
		this.states = new Map();
		this.disposeFlag = new DisposeFlag();
	}

	public setMaxAge(maxAge: number): void {
		this.disposeFlag.assertNotDisposed();
		this.cache.setMaxAge(maxAge);
	}

	public setMaxSize(maxSize: number): void {
		this.disposeFlag.assertNotDisposed();
		this.cache.setMaxAge(maxSize);
	}

	public clear(): void {
		this.disposeFlag.assertNotDisposed();
		this.states.clear();
		this.cache.clear();
	}

	public dispose(): void {
		this.clear();
		this.disposeFlag.set();
	}

	public prune(): void {
		this.cache.tick();
	}

	public size(): number {
		return this.cache.size();
	}

	public getTile(tileId: TileId): TileRecord<Payload> | undefined {
		this.disposeFlag.assertNotDisposed();

		switch (this.states.get(tileId)) {
			case TileState.READY: {
				const stored = this.cache.get(tileId);

				if (stored === undefined) {
					this.states.delete(tileId);
					return undefined;
				} else {
					return {
						state: TileState.READY,
						payload: stored,
					};
				}
			}

			case TileState.QUEUED:
				return { state: TileState.QUEUED };

			case TileState.RENDERING:
				return { state: TileState.RENDERING };

			default:
				return undefined;
		}
	}

	public setQueued(tileId: TileId): void {
		this.disposeFlag.assertNotDisposed();

		const state = this.states.get(tileId);

		if (state === undefined) {
			this.states.set(tileId, TileState.QUEUED);
		} else if (state !== TileState.QUEUED) {
			throw new Error(`Enqueueing a tile that is in the store: ${tileId}.`);
		}
	}

	public setRendering(tileId: TileId): void {
		this.disposeFlag.assertNotDisposed();

		const state = this.states.get(tileId);

		if (state === undefined) {
			throw new Error(`Rendering a tile that is not in the store: ${tileId}.`);
		} else if (state !== TileState.QUEUED) {
			throw new Error(`Rendering a tile that is not enqueued: ${tileId}.`);
		} else {
			this.states.set(tileId, TileState.RENDERING);
		}
	}

	public setReady(tileId: TileId, payload: Payload): void {
		this.disposeFlag.assertNotDisposed();

		const state = this.states.get(tileId);

		if (state === undefined) {
			throw new Error(`Readying a tile that is not in the store: ${tileId}.`);
		} else if (state !== TileState.RENDERING) {
			throw new Error(`Readying a tile that is not rendering: ${tileId}.`);
		} else {
			this.states.set(tileId, TileState.READY);
			this.cache.insert(tileId, payload);
		}
	}

	public resetFailedTileToQueue(tileIds: TileId[]): void {
		this.disposeFlag.assertNotDisposed();

		tileIds.forEach((tileId) => {
			const state = this.states.get(tileId);

			if (state === undefined) {
				throw new Error(`Reseting a tile that is not in the store: ${tileId}.`);
			} else if (state != TileState.RENDERING) {
				throw new Error(`Reseting a tile that is not rendering: ${tileId}.`);
			} else {
				this.states.set(tileId, TileState.QUEUED);
			}
		});
	}
}
