import { tileId, type Tile } from "@common/tiles";
import { TileState, TileStore } from "@lib/store";
import { JobQueue } from "./queue";
import { ReadAndClearFlag } from "@common/flag";
import { TileSetter, type ViewCornerTiles } from "./tiles";
import type { Camera } from "./camera";
import type { Plane } from "@common/types";
import {
	TSSupervisor,
	type BitmapTileResult,
	type TSJobAssignment,
} from "./supervisors/ts-supervisor";
import type { WorkerOutMessage, WorkerInMessage } from "@common/protocol";

export class TilePainter {
	private resolution: number = 128;

	private readonly store: TileStore<BitmapTileResult>;
	private readonly queue: JobQueue<
		WorkerInMessage,
		WorkerOutMessage<ArrayBuffer>,
		TSJobAssignment,
		BitmapTileResult
	>;
	private readonly dirtyFlag: ReadAndClearFlag;
	private readonly camera: Camera;
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly tileSetter: TileSetter;
	private previousCorners: ViewCornerTiles | null;

	public constructor(plane: Plane, canvas: HTMLCanvasElement, camera: Camera) {
		const ctx = canvas.getContext("2d");

		if (!ctx) {
			throw Error("Canvas context is empty.");
		}

		this.ctx = ctx;
		this.canvas = canvas;
		this.store = new TileStore(15000, 10, 100);
		this.dirtyFlag = new ReadAndClearFlag(true);
		this.tileSetter = new TileSetter(plane);
		this.previousCorners = null;

		this.queue = new JobQueue(new TSSupervisor(), this.store, 4);
		this.camera = camera;
	}

	public forceRedraw() {
		this.dirtyFlag.set();
	}

	public draw() {
		let dirty = this.queue.readAndClearDirtyness();
		dirty = this.dirtyFlag.readAndClear() || dirty;

		if (!dirty) return;

		this.clearCanvas();

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

	private determineVisibleTiles(depth: number): Tile[] {
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

	private paintTiles(tiles: Tile[]) {
		tiles.forEach(this.paintTile);
	}

	private paintTile = (tile: Tile) => {
		const record = this.store.getTile(tileId(tile));

		if (record && record.state == TileState.READY) {
			const left = Math.round(this.camera.planeXToCamera(tile.section.minX));
			const right = Math.round(this.camera.planeXToCamera(tile.section.maxX));
			const top = Math.round(this.camera.planeYToCamera(tile.section.minY));
			const bottom = Math.round(this.camera.planeYToCamera(tile.section.maxY));

			const w = right - left;
			const h = bottom - top;

			// ensure the worker rendered this exact size (device pixels)
			// i.e., when you queued the job: texels = w, height = h

			this.ctx.drawImage(record.payload.bitmap, left, top, w, h);

			// TODO make the old code reusable in some "debug mode"
			// const color = this.tileColor(record.state);
			// if (color === undefined) return;
			//
			// const camBounds = this.camera.planeBoundsToCamera(tile.section);
			//
			// const { minX, minY } = camBounds;
			// const { width, height } = boundsToRect(camBounds);
			//
			// this.ctx.fillStyle = color;
			// this.ctx.fillRect(minX, minY, width, height);
			// this.ctx.strokeRect(minX, minY, width, height);
		}
	};

	// private tileColor(state: TileState): string | undefined {
	// 	if (state === TileState.READY) return "#0f0";
	// 	if (state === TileState.RENDERING) return "#ff4";
	// 	else return undefined;
	// }

	private clearCanvas() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.fillStyle = "#fff";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.strokeStyle = "#000";
		this.ctx.lineWidth = 1;
	}

	private checkSameCorners(corners: ViewCornerTiles): boolean {
		if (!this.previousCorners || !this.previousCorners.isSameAs(corners)) {
			this.previousCorners = corners;
			return false;
		} else {
			return true;
		}
	}

	private prepareTiles(tiles: Tile[]) {
		for (const tile of tiles) {
			const tid = tileId(tile);
			const record = this.store.getTile(tid);

			if (!record || record.state == TileState.QUEUED) {
				this.store.setQueued(tid);
				this.queue.enqueueEnd({ tile: tile, tileId: tid });
			}
		}
	}
}
