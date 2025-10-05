import {
	type TileResult,
	type TileWithKey,
	type TileWithKeyAndID,
	tileKeyToId,
} from "@mandelbrot/common";
import { assertGtZero } from "@mandelbrot/common/asserts";
import type Cache from "./cache";
import type Camera from "./camera";
import type Painter from "./painter";
import { TileSetter } from "./tile-setter";

export default class ImageComposer<Paintable> {
	private painter: Painter<Paintable>;
	private cache: Cache<TileResult<Paintable>>;
	private camera: Camera;
	private tileSetter: TileSetter;

	public constructor(
		tileSize: number,
		camera: Camera,
		cache: Cache<TileResult<Paintable>>,
		painter: Painter<Paintable>,
	) {
		assertGtZero(tileSize);

		this.camera = camera;
		this.painter = painter;
		this.cache = cache;

		this.tileSetter = new TileSetter(camera.planeSide, tileSize);
	}

	public setTileSize(tileSize: number): void {
		assertGtZero(tileSize);
		this.tileSetter.setResolution(tileSize);
	}

	// TODO this is a hack, move this logic one level up
	public invalidateRememberedView(): void {
		this.tileSetter.clearRememberedView();
	}

	public getTileSize(): number {
		return this.tileSetter.getResolution();
	}

	public compose(): TileWithKeyAndID[] | null {
		const bounds = this.camera.viewportBounds();
		const resolution = this.tileSetter.getResolution();
		const depth = this.camera.getDepthPerResolution(resolution);
		const tiles = this.determineVisibleTiles(depth);

		const cacheMisses: TileWithKeyAndID[] = [];
		const cacheHits: TileResult<Paintable>[] = [];

		for (const tile of tiles) {
			const tileId = tileKeyToId(tile.key);
			const cached = this.cache.get(tileId);

			if (cached === undefined) {
				cacheMisses.push({
					...tile,
					tileId,
				});
			} else {
				cacheHits.push(cached);
			}
		}

		this.painter.clearCanvas();
		this.painter.paintTiles(cacheHits);

		// TODO move this out
		if (this.tileSetter.didViewChange(bounds, depth)) {
			return cacheMisses;
		} else {
			/** If view didn't change, we dont have to return new misses */
			return null;
		}
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
}
