import { TileState, type Tile } from "@common/tiles";
import { TileStore } from "@lib/store";
import { WorkerExecutorQueue } from "./queue";
import { ReadAndClearFlag } from "@common/flag";
import { TileSetter, type ViewCornerTiles } from "./tiles";
import type { Camera } from "./camera";
import type { Plane } from "@common/types";
import { boundsToRect } from "@common/utils";

export class TilePainter {
	private readonly store: TileStore<null>;
	private readonly queue: WorkerExecutorQueue<null>;
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
		this.store = new TileStore();
		this.dirtyFlag = new ReadAndClearFlag(true);
		this.tileSetter = new TileSetter(plane);
		this.previousCorners = null;

		// TODO determine worker size
		this.queue = new WorkerExecutorQueue<null>(this.store, this.dirtyFlag, 8);
		this.camera = camera;
	}

	public forceRedraw() {
		this.dirtyFlag.set();
	}

	public draw() {
		if (!this.dirtyFlag.readAndClear()) return;
		this.clearCanvas();

		const depth = this.camera.optimalDepthLevelPerResolution(256);
		const bounds = this.camera.viewportBounds();
		const corners = this.tileSetter.cornerTiles(bounds, depth);
		const tiles = this.determineVisibleTiles(depth);

		if (!this.checkSameCorners(corners)) {
			this.queue.clearQueue();
			this.prepareTiles(tiles);
			this.store.prune();
		}

		this.paintTiles(tiles);
	}

	public clear() {
		this.queue.dispose();
		this.store.clear();
		this.previousCorners = null;
	}

	private determineVisibleTiles(depth: number): Tile[] {
		return [
			...this.tileSetter.layTilesFromViewBounds(
				this.camera.viewportBounds(),
				depth - 2,
			),
			...this.tileSetter.layTilesFromViewBounds(
				this.camera.viewportBounds(),
				depth - 1,
			),
			...this.tileSetter.layTilesFromViewBounds(
				this.camera.viewportBounds(),
				depth,
			),
		];
	}

	private paintTiles(tiles: Tile[]) {
		tiles.forEach(this.paintTile);
	}

	private paintTile = (tile: Tile) => {
		const record = this.store.getTileRecord(tile.key.id());

		if (record && record.state != TileState.QUEUED) {
			const color = this.tileColor(record.state);
			if (color === undefined) return;

			const camBounds = this.camera.planeBoundsToCamera(tile.section);

			const { minX, minY } = camBounds;
			const { width, height } = boundsToRect(camBounds);

			this.ctx.fillStyle = color;
			this.ctx.fillRect(minX, minY, width, height);
			this.ctx.strokeRect(minX, minY, width, height);
		}
	};

	private tileColor(state: TileState): string | undefined {
		if (state === TileState.READY) return "#0f0";
		if (state === TileState.RENDERING) return "#ff4";
		else return undefined;
	}

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
			const record = this.store.getTileRecord(tile.key.id());

			if (!record || record.state == TileState.QUEUED) {
				this.store.setQueued(tile.key.id());
				this.queue.enqueue(tile);
			}
		}
	}
}
