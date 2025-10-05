import type { TileResult } from "@mandelbrot/common";
import type { Bounds } from "@mandelbrot/common/types";
import { BitmapSupervisor } from "@mandelbrot/workers";
import type Camera from "./camera";
import Orchestrator, { type OrchestratorProps } from "./orchestrator";
import type Painter from "./painter";

export class BitmapPainter implements Painter<ImageBitmap> {
	private camera: Camera;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;

	public constructor(camera: Camera, canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");

		if (!ctx) {
			throw Error("Canvas context is empty.");
		}

		this.ctx = ctx;
		this.canvas = canvas;
		this.camera = camera;
	}

	public paintTiles(tiles: TileResult<ImageBitmap>[]): void {
		this.assertInit();

		for (const result of tiles) {
			const bitmap = result.payload;
			const tileBounds = result.tile.section;
			const pixelBounds = this.camera.planeBoundsToCamera(tileBounds);

			this.drawBitmap(bitmap, pixelBounds);
		}
	}

	public clearCanvas() {
		this.assertInit();

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.fillStyle = "#111";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.strokeStyle = "#000";
		this.ctx.lineWidth = 1;
	}

	private drawBitmap(bitmap: ImageBitmap, bounds: Bounds) {
		this.assertInit();

		const left = Math.round(bounds.minX);
		const right = Math.round(bounds.maxX);
		const top = Math.round(bounds.minY);
		const bottom = Math.round(bounds.maxY);

		const width = right - left;
		const height = bottom - top;

		this.ctx.drawImage(bitmap, left, top, width, height);
	}

	private assertInit() {
		if (this.canvas == null) {
			throw new Error("Canvas not set inside the paitner");
		}

		if (this.ctx == null) {
			throw new Error("Context not set inside the painter");
		}

		if (this.camera == null) {
			throw new Error("Camera not set inside the painter");
		}
	}
}

export function createBitmapOrchestrator(
	constr: new () => Worker,
	canvas: HTMLCanvasElement,
	camera: Camera,
	props: Partial<OrchestratorProps> = {},
): Orchestrator<ImageBitmap, ArrayBufferLike> {
	const supervisor = new BitmapSupervisor(constr);
	const painter = new BitmapPainter(camera, canvas);

	return new Orchestrator(supervisor, painter, camera, props, {
		jobDone: (result, ctx) => {
			ctx.cache.insert(result.tileId, result);
			ctx.dirtyFlag.set();
		},
	});
}
