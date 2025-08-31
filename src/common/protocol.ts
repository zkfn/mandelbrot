import type { Tile, TileId } from "@common/tiles";

export type WorkerInMessage = {
	tileId: TileId;
	tile: Tile;
	maxIter?: number;
};

export type WorkerOutMessage<Payload> = {
	tileId: TileId;
	tile: Tile;
	payload: Payload;
};
