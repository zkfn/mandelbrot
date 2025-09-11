import type { TileKey, TileWithKey } from "@common/tiles";
import type { Plane, Bounds } from "@common/types";

class ViewCornerTiles implements Bounds {
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
	private previousCorners: ViewCornerTiles | null;
	private resolution: number;

	public constructor(plane: Plane, resolution: number = 256) {
		this.planeSide = plane.side;
		this.resolution = resolution;
		this.previousCorners = null;
	}

	public setResolution(resolution: number): void {
		if (resolution != this.resolution) {
			this.resolution = resolution;
			this.previousCorners = null;
		}
	}

	public getResolution(): number {
		return this.resolution;
	}

	public didViewChange(bounds: Bounds, depth: number): boolean {
		const corners = this.cornerTiles(bounds, depth);

		if (!this.previousCorners || !this.previousCorners.isSameAs(corners)) {
			this.previousCorners = corners;
			return true;
		} else {
			return false;
		}
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
					width: this.resolution,
					height: this.resolution,
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

	private cornerTiles(viewBounds: Bounds, depth: number): ViewCornerTiles {
		const tileWidthUnits = this.tileUnitSizeFromDepthLevel(depth);

		return new ViewCornerTiles(
			depth,
			Math.floor(viewBounds.minX / tileWidthUnits),
			Math.ceil(viewBounds.maxX / tileWidthUnits),
			Math.floor(viewBounds.minY / tileWidthUnits),
			Math.ceil(viewBounds.maxY / tileWidthUnits),
		);
	}

	private tileUnitSizeFromDepthLevel(depthLevel: number): number {
		return this.planeSide / Math.pow(2, depthLevel);
	}
}
