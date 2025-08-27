import type { Bounds } from "@common/types";

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
