import {
	type TileResult,
	Tiler,
	type TileWithKey,
	type TileWithKeyAndID,
	tileKeyToId,
} from "@mandelbrot/common";
import type Cache from "./cache";
import type Camera from "./camera";
import type Painter from "./painter";

export default class ImageComposer<Paintable> {
	private painter: Painter<Paintable>;
	private cache: Cache<TileResult<Paintable>>;
	private camera: Camera;
	private tiler: Tiler;

	public constructor(
		camera: Camera,
		cache: Cache<TileResult<Paintable>>,
		painter: Painter<Paintable>,
		tiler: Tiler,
	) {
		this.camera = camera;
		this.painter = painter;
		this.cache = cache;
		this.tiler = tiler;
	}

	public compose(): TileWithKeyAndID[] {
		const tileSize = this.tiler.getTileSize();
		const depth = this.camera.getDepthPerResolution(tileSize);
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

		return cacheMisses;
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
		return this.tiler
			.layTiles(this.camera.viewportBounds(), depth)
			.map((v) => v);
	}
}
