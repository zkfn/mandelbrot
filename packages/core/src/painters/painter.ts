import type { WithTileId } from "@mandelbrot/common";
import type { TileRecord } from "../store";

export interface Painter<Result extends WithTileId> {
	clearCanvas(): void;
	paintTiles(tiles: TileRecord<Result>[]): void;
}
