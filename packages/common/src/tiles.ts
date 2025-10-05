import type { Bounds, Rect } from "./types";

export const tileKeyToId = (key: TileKey): TileId => {
	return `${key.depth}:${key.ix}:${key.iy}`;
};

export type TileId = string;

export interface TileKey {
	depth: number;
	ix: number;
	iy: number;
}

export interface Tile {
	section: Bounds;
	resolution: Rect;
}

export interface TileWithKey extends Tile {
	key: TileKey;
}

export interface WithTileId {
	tileId: TileId;
}

export interface TileWithKeyAndID extends TileWithKey, WithTileId {}

export interface TileAssignment extends WithTileId {
	maxIter: number;
	tile: Tile;
}

export interface TileResult<Payload> extends WithTileId {
	payload: Payload;
	tile: Tile;
}

export interface TileAssignment extends WithTileId {
	tile: Tile;
	maxIter: number;
}

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

export class Tiler {
	private planeSide: number;
	private tileSize: number;

	public constructor(planeSide: number, tileSize: number) {
		this.planeSide = planeSide;
		this.tileSize = tileSize;
	}

	public setTileSize(tileSize: number): void {
		this.tileSize = tileSize;
	}

	public getTileSize(): number {
		return this.tileSize;
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

	public layTiles(view: Bounds, depth: number): TileWithKey[] {
		const corners = this.cornerTiles(view, depth);

		const tiles: TileWithKey[] = [];
		const tileWidthUnits = this.tileUnitSizeFromDepthLevel(corners.depth);

		let minX;
		let maxX;

		let minY = corners.minY * tileWidthUnits;
		let maxY = minY + tileWidthUnits;

		for (let iy = corners.minY; iy < corners.maxY; iy++) {
			minX = corners.minX * tileWidthUnits;
			maxX = minX + tileWidthUnits;

			for (let ix = corners.minX; ix < corners.maxX; ix++) {
				const key: TileKey = { depth: corners.depth, ix, iy };
				const section = { minX, maxX, minY, maxY };
				const rect = {
					width: this.tileSize,
					height: this.tileSize,
					top: 0,
					left: 0,
				};

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
