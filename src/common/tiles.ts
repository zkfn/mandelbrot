import type { Bounds, Rect } from "@common/types";

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

export interface TileAssignment extends WithTileId {
	maxIter: number;
	tile: Tile;
}
