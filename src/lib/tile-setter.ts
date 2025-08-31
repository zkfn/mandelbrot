import type { TileKey, TileWithKey } from "@common/tiles";
import type { Plane, Bounds } from "@common/types";

export class ViewCornerTiles implements Bounds {
	public constructor(
		public depth: number,
		public minX: number,
		public maxX: number,
		public minY: number,
		public maxY: number,
	) {}

	public isSameAs(other: ViewCornerTiles) {
		return (
			this.depth === other.depth &&
			this.minX === other.minX &&
			this.maxX === other.maxX &&
			this.minY === other.minY &&
			this.maxY === other.maxY
		);
	}
}

export class TileSetter {
	private planeSide: number;

	public constructor(plane: Plane) {
		this.planeSide = plane.side;
	}

	public cornerTiles(viewBounds: Bounds, depth: number): ViewCornerTiles {
		const tileWidthUnits = this.tileUnitSizeFromDepthLevel(depth);

		return new ViewCornerTiles(
			depth,
			Math.floor(viewBounds.minX / tileWidthUnits),
			Math.ceil(viewBounds.maxX / tileWidthUnits),
			Math.floor(viewBounds.minY / tileWidthUnits),
			Math.ceil(viewBounds.maxY / tileWidthUnits),
		);
	}

	public layTilesFromViewBounds(
		view: Bounds,
		depth: number,
		resolution: number,
	): TileWithKey[] {
		return this.layTilesFromCorners(this.cornerTiles(view, depth), resolution);
	}

	public layTilesFromCorners(
		cornerTiles: ViewCornerTiles,
		resolution: number,
	): TileWithKey[] {
		const tiles: TileWithKey[] = [];
		const tileWidthUnits = this.tileUnitSizeFromDepthLevel(cornerTiles.depth);

		let minX;
		let maxX;

		let minY = cornerTiles.minY * tileWidthUnits;
		let maxY = minY + tileWidthUnits;

		for (let iy = cornerTiles.minY; iy < cornerTiles.maxY; iy++) {
			minX = cornerTiles.minX * tileWidthUnits;
			maxX = minX + tileWidthUnits;

			for (let ix = cornerTiles.minX; ix < cornerTiles.maxX; ix++) {
				const key: TileKey = { depth: cornerTiles.depth, ix, iy };
				const section = { minX, maxX, minY, maxY };
				const rect = { width: resolution, height: resolution, top: 0, left: 0 };

				const tile: TileWithKey = {
					section,
					resolution: rect,
					key,
				};

				tiles.push(tile);
				minX = maxX;
				maxX += tileWidthUnits;
			}

			minY = maxY;
			maxY += tileWidthUnits;
		}

		return tiles;
	}

	private tileUnitSizeFromDepthLevel(depthLevel: number): number {
		return this.planeSide / Math.pow(2, depthLevel);
	}
}
