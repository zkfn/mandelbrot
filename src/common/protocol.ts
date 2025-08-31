import type { Tile } from "@common/tiles";

export type WorkerInMessage = {
	tile: Tile;
	maxIter?: number;
};

export type WorkerOutMessage<Payload> = {
	tile: Tile;
	payload: Payload;
};
