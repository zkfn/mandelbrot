import { boundsToRect, planeToBounds } from "@common/utils";
import type { Plane, Bounds, Rect } from "@common/types";

export type TileId = string;

export enum TileState {
	QUEUED,
	RENDERING,
	READY,
}

export class TileKey {
	public constructor(
		public depth: number,
		public ix: number,
		public iy: number,
	) {}

	public id(): TileId {
		return `${this.depth}:${this.ix}:${this.iy}`;
	}
}

export class Tile {
	public constructor(
		public section: Bounds,
		public key: TileKey,
	) {}
}

export class TileSetter {
	private planeRectUnits: Rect;

	public constructor(plane: Plane) {
		this.planeRectUnits = boundsToRect(planeToBounds(plane));
	}

	public layTiles(boundsUnits: Bounds, depthLevel: number): Tile[] {
		const tiles: Tile[] = [];

		const tileWidthUnits = this.tileUnitSizeFromDepthLevel(depthLevel);

		const ix0 = Math.floor(boundsUnits.minX / tileWidthUnits);
		const iy0 = Math.floor(boundsUnits.minY / tileWidthUnits);

		const ixmax = Math.ceil(boundsUnits.maxX / tileWidthUnits);
		const iymax = Math.ceil(boundsUnits.maxY / tileWidthUnits);

		let minX;
		let maxX;

		let minY = iy0 * tileWidthUnits;
		let maxY = minY + tileWidthUnits;

		for (let iy = iy0; iy < iymax; iy++) {
			minX = ix0 * tileWidthUnits;
			maxX = minX + tileWidthUnits;

			for (let ix = ix0; ix < ixmax; ix++) {
				const key = new TileKey(depthLevel, ix, iy);
				const tile = new Tile({ minX, maxX, minY, maxY }, key);
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
		return this.planeRectUnits.width / Math.pow(2, depthLevel);
	}
}
