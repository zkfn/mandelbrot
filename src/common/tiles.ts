import type { Bounds, Rect } from "@common/types";

export const tileId = (tile: Tile): string => {
	return `${tile.key.depth}:${tile.key.ix}:${tile.key.iy}`;
};

export type TileId = string;

export enum TileState {
	QUEUED,
	RENDERING,
	READY,
}

export interface TileKey {
	depth: number;
	ix: number;
	iy: number;
}

export interface Tile {
	section: Bounds;
	rect: Rect;
	key: TileKey;
}
