import { tileKeyToId, type TileWithKey, type WithTileId } from "@common/tiles";
import { TileState, TileStore } from "@lib/store";
import { JobQueue } from "./queue";
import { DisposeFlag, ReadAndClearFlag } from "@common/flag";
import { TileSetter } from "./tile-setter";

import type { Camera } from "./camera";
import type { Plane } from "@common/types";
import type { Supervisor, SupervisorsResult } from "./supervisors/supervisor";
import type { Painter } from "@lib/painters/painter";

export class Composer<ST extends Supervisor<any, WithTileId>> {
	private maxIter: number = 500;

	private readonly disposeFlag: DisposeFlag;
	private readonly painter: Painter<SupervisorsResult<ST>>;
	private readonly store: TileStore<SupervisorsResult<ST>>;
	private readonly queue: JobQueue<ST>;

	private readonly tileSetter: TileSetter;
	private readonly camera: Camera;
	private readonly dirtyFlag: ReadAndClearFlag;

	public constructor(
		plane: Plane,
		store: TileStore<SupervisorsResult<ST>>,
		queue: JobQueue<ST>,
		painter: Painter<SupervisorsResult<ST>>,
		camera: Camera,
		resolution: number,
	) {
		this.store = store;
		this.queue = queue;
		this.camera = camera;
		this.painter = painter;
		this.tileSetter = new TileSetter(plane, resolution);
		this.disposeFlag = new DisposeFlag();

		this.dirtyFlag = new ReadAndClearFlag(true);
		this.queue.addInvalidator(this.dirtyFlag.set);
		this.camera.addInvalidator(this.dirtyFlag.set);
	}

	public dispose(): void {
		this.disposeFlag.set();
		this.queue.removeInvalidator(this.dirtyFlag.set);
		this.camera.removeInvalidator(this.dirtyFlag.set);
	}

	public draw() {
		this.disposeFlag.assertNotDisposed();

		if (!this.dirtyFlag.readAndClear()) {
			return;
		}

		const bounds = this.camera.viewportBounds();
		const resolution = this.tileSetter.getResolution();
		const depth = this.camera.getDepthPerResolution(resolution);
		const tiles = this.determineVisibleTiles(depth);

		if (this.tileSetter.didViewChange(bounds, depth)) {
			this.queue.prune();
			this.prepareTiles(tiles);
			this.store.prune();
		}

		this.painter.clearCanvas();
		this.painter.paintTiles(
			tiles
				.map((tile) => this.store.getTile(tileKeyToId(tile.key)))
				.filter((tile) => tile !== undefined),
		);
	}

	public getResolution(): number {
		return this.tileSetter.getResolution();
	}

	public setResolution(resolution: number): void {
		if (resolution != this.tileSetter.getResolution()) {
			this.tileSetter.setResolution(resolution);
			this.queue.clear();
			this.store.clear();
			this.dirtyFlag.set();
		}
	}

	private determineVisibleTiles(depth: number): TileWithKey[] {
		return [
			...this.tileSetter.layTiles(this.camera.viewportBounds(), depth - 3),
			...this.tileSetter.layTiles(this.camera.viewportBounds(), depth - 2),
			...this.tileSetter.layTiles(this.camera.viewportBounds(), depth - 1),
			...this.tileSetter.layTiles(this.camera.viewportBounds(), depth),
		];
	}

	private prepareTiles(tiles: TileWithKey[]) {
		for (const tile of tiles) {
			const tid = tileKeyToId(tile.key);
			const record = this.store.getTile(tid);

			if (!record || record.state == TileState.QUEUED) {
				this.store.setQueued(tid);
				this.queue.enqueueEnd({
					tile: tile,
					tileId: tid,
					maxIter: this.maxIter,
				});
			}
		}
	}
}
