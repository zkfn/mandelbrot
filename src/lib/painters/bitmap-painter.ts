import { TileState } from "@lib/store";
import type { Painter } from "@lib/painters/painter";
import type { TileResult } from "@common/protocol";
import type { TileRecord } from "@lib/store";
import type { Bounds } from "@common/types";
import type { Camera } from "@lib/camera";

export type BitmapResult = TileResult<ImageBitmap>;

export class BitmapPainter implements Painter<BitmapResult> {
	private camera: Camera;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;

	public constructor() {
		this.camera = null!;
		this.canvas = null!;
		this.ctx = null!;
	}

	public paintTiles(tiles: TileRecord<BitmapResult>[]): void {
		this.assertInit();

		for (const record of tiles) {
			if (record.state == TileState.READY) {
				const result = record.payload;
				const bitmap = result.payload;
				const tileBounds = result.tile.section;
				const pixelBounds = this.camera.planeBoundsToCamera(tileBounds);

				this.drawBitmap(bitmap, pixelBounds);
			}
		}
	}

	public setCanvas(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");

		if (!ctx) {
			throw Error("Canvas context is empty.");
		}

		this.ctx = ctx;
		this.canvas = canvas;
	}

	public setCamera(camera: Camera) {
		this.camera = camera;
	}

	public clearCanvas() {
		this.assertInit();

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.fillStyle = "#fff";
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
