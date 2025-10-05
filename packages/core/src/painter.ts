import type { TileResult } from "@mandelbrot/common";

export default interface Painter<Result> {
	clearCanvas(): void;
	paintTiles(tiles: TileResult<Result>[]): void;
}
