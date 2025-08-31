import type { Bounds } from "@common/types";
import { boundsToRect } from "@common/utils";

export class TilePainter {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;

	constructor(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");

		if (!ctx) {
			throw Error("Canvas context is empty.");
		}

		this.ctx = ctx;
		this.canvas = canvas;
	}

	public clearCanvas() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.fillStyle = "#fff";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.strokeStyle = "#000";
		this.ctx.lineWidth = 1;
	}

	public drawBitmap(bitmap: ImageBitmap, bounds: Bounds) {
		const left = Math.round(bounds.minX);
		const right = Math.round(bounds.maxX);
		const top = Math.round(bounds.minY);
		const bottom = Math.round(bounds.maxY);

		const width = right - left;
		const height = bottom - top;

		this.ctx.drawImage(bitmap, left, top, width, height);
	}

	public drawDebugTile(fill: string, stroke: string, bounds: Bounds) {
		if (fill === undefined) return;

		const { minX, minY } = bounds;
		const { width, height } = boundsToRect(bounds);

		this.ctx.fillStyle = fill;
		this.ctx.fillRect(minX, minY, width, height);
		this.ctx.strokeStyle = stroke;
		this.ctx.strokeRect(minX, minY, width, height);
	}
}
