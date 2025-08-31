import { tileKeyToId, type TileWithKey } from "@common/tiles";
import { TileState, TileStore } from "@lib/store";
import { JobQueue } from "./queue";
import { readAndClearMultiple } from "@common/flag";
import { TileSetter, type ViewCornerTiles } from "./tile-setter";
import {
	TSSupervisor,
	type BitmapTileResult,
	type TSJobAssignment,
} from "./supervisors/ts-supervisor";

import type { Camera } from "./camera";
import type { Plane } from "@common/types";
import type { WorkerOutMessage, WorkerInMessage } from "@common/protocol";
import type { TilePainter } from "./painter";

export class Composer {
	private resolution: number = 128;

	private readonly painter: TilePainter;
	private readonly store: TileStore<BitmapTileResult>;
	private readonly queue: JobQueue<
		WorkerInMessage,
		WorkerOutMessage<ArrayBuffer>,
		TSJobAssignment,
		BitmapTileResult
	>;

	private readonly tileSetter: TileSetter;
	private readonly camera: Camera;
	private previousCorners: ViewCornerTiles | null;

	public constructor(plane: Plane, painter: TilePainter, camera: Camera) {
		this.store = new TileStore(15000, 10, 100);
		this.tileSetter = new TileSetter(plane);
		this.previousCorners = null;

		this.queue = new JobQueue(new TSSupervisor(), this.store, 4);
		this.camera = camera;
		this.painter = painter;
	}

	public draw() {
		if (!readAndClearMultiple(this.queue.dirtyFlag, this.camera.dirtyFlag)) {
			return;
		}

		this.painter.clearCanvas();

		const depth = this.camera.optimalDepthLevelPerResolution(this.resolution);
		const bounds = this.camera.viewportBounds();
		const corners = this.tileSetter.cornerTiles(bounds, depth);
		const tiles = this.determineVisibleTiles(depth);

		if (!this.checkSameCorners(corners)) {
			this.queue.prune();
			this.prepareTiles(tiles);
			this.store.prune();
		}

		this.paintTiles(tiles);
	}

	public dispose() {
		this.queue.dispose();
		this.store.dispose();
		this.previousCorners = null;
	}

	private determineVisibleTiles(depth: number): TileWithKey[] {
		return [
			...this.tileSetter.layTilesFromViewBounds(
				this.camera.viewportBounds(),
				depth - 3,
				this.resolution,
			),
			...this.tileSetter.layTilesFromViewBounds(
				this.camera.viewportBounds(),
				depth - 2,
				this.resolution,
			),
			...this.tileSetter.layTilesFromViewBounds(
				this.camera.viewportBounds(),
				depth - 1,
				this.resolution,
			),
			...this.tileSetter.layTilesFromViewBounds(
				this.camera.viewportBounds(),
				depth,
				this.resolution,
			),
		];
	}

	private paintTiles(tiles: TileWithKey[]) {
		for (const tile of tiles) {
			const record = this.store.getTile(tileKeyToId(tile.key));

			if (record?.state == TileState.READY) {
				const payload = record.payload;
				const bounds = this.camera.planeBoundsToCamera(tile.section);

				this.painter.drawBitmap(payload.bitmap, bounds);
			}
		}
	}

	private checkSameCorners(corners: ViewCornerTiles): boolean {
		if (!this.previousCorners || !this.previousCorners.isSameAs(corners)) {
			this.previousCorners = corners;
			return false;
		} else {
			return true;
		}
	}

	private prepareTiles(tiles: TileWithKey[]) {
		for (const tile of tiles) {
			const tid = tileKeyToId(tile.key);
			const record = this.store.getTile(tid);

			if (!record || record.state == TileState.QUEUED) {
				this.store.setQueued(tid);
				this.queue.enqueueEnd({ tile: tile, tileId: tid });
			}
		}
	}
}
