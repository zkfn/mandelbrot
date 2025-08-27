import { Tile, type TileId } from "@common/tiles";

export type WorkerInMessage = {
	jobId: number;
	tileId: TileId;
	tile: Tile;
};

export type WorkerOutMessage<Payload> = {
	jobId: number;
	tileId: string;
	payload: Payload;
};
