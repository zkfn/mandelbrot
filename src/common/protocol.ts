import type { Tile, WithTileId } from "@common/tiles";

export interface TileResult<Payload> extends WithTileId {
	payload: Payload;
	tile: Tile;
}

export interface TileAssignment extends WithTileId {
	tile: Tile;
	maxIter: number;
}
