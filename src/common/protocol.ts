import type { Tile } from "@common/tiles";

export type WorkerInMessage = {
	jobId: number;
	tile: Tile;
	maxIter?: number;
};

export type WorkerOutMessage<Payload> = {
	jobId: number;
	tile: Tile;
	payload: Payload;
};
