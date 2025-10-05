import type { TileResult } from "@mandelbrot/common";

export interface Painter<Result> {
	clearCanvas(): void;
	paintTiles(tiles: TileResult<Result>[]): void;
}
