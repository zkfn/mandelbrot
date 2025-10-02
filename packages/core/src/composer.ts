import type { TileWithKey, WithTileId } from "@mandelbrot/common";
import { DisposeFlag, ReadAndClearFlag, tileKeyToId } from "@mandelbrot/common";
import type { Plane } from "@mandelbrot/common/types";
import type { Camera } from "./camera";
import type { Painter } from "./painters";
import { JobQueue } from "./queue";
import { TileState, TileStore } from "./store";
import type { Supervisor, SupervisorsResult } from "./supervisors";
import { TileSetter } from "./tile-setter";

export class Composer<ST extends Supervisor<unknown, WithTileId>> {
	private maxIterations: number;
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
		resolution: number = 64,
		iterations: number = 500,
	) {
		this.store = store;
		this.queue = queue;
		this.camera = camera;
		this.painter = painter;
		this.maxIterations = iterations;

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
		this.tileSetter.clearRememberedView();
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

	public setResolution(resolution: number): void {
		if (resolution != this.tileSetter.getResolution()) {
			this.tileSetter.setResolution(resolution);
			this.queue.clear();
			this.store.clear();
			this.tileSetter.clearRememberedView();
			this.dirtyFlag.set();
		}
	}

	public getResolution(): number {
		return this.tileSetter.getResolution();
	}

	public setMaxIterations(iterations: number): void {
		if (iterations != this.maxIterations) {
			this.maxIterations = iterations;
			this.queue.clear();
			this.store.clear();
			this.tileSetter.clearRememberedView();
			this.dirtyFlag.set();
		}
	}

	public getMaxIterations(): number {
		return this.maxIterations;
	}

	private determineVisibleTiles(depth: number): TileWithKey[] {
		return [
			...this.determineTilesPerDepth(depth - 3),
			...this.determineTilesPerDepth(depth - 2),
			...this.determineTilesPerDepth(depth - 1),
			...this.determineTilesPerDepth(depth),
		];
	}

	private determineTilesPerDepth(depth: number): TileWithKey[] {
		return this.tileSetter
			.layTiles(this.camera.viewportBounds(), depth)
			.map((v) => v);
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
					maxIter: this.maxIterations,
				});
			}
		}
	}
}
