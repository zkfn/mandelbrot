import type { WithTileId } from "@common/tiles";
import type { TileRecord } from "@lib/store";

export interface Painter<Result extends WithTileId> {
	clearCanvas(): void;
	paintTiles(tiles: TileRecord<Result>[]): void;
}
