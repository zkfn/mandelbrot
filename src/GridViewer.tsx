import { useEffect, useLayoutEffect, useRef, type FC } from "react";
import {
	aspectRatio,
	bounds,
	boundsToRect,
	rect,
	type Bounds,
	type Rect,
} from "./bounds";

interface GridViewerProps {
	cplaneBounds: Bounds;
}

class Tile {
	constructor(
		public xPx: number,
		public yPx: number,
		public widthPx: number,
	) {}
}

/**
 *  When dealing with GridViewer, there are 3 separate coordinate systems that
 *  need to be distinguished:
 *
 *  1) plane: Complex plane, measured simly in math _units_.
 *  2) canvas: Pixels referring precisely to _pixels_ on screen.
 *  3) tile: As we zoom in, finer and finer images are rendered. The unit of
 *           space that is being rendered each time is a tile. To distinguish
 *           pixels rendered per tile and pixel on the screen, the pixel of
 *           tile will be referred to as _texels_.
 *
 */

class WorldScaler {
	public static texelsPerTile = 256;
	public static tileScreenSizeUpTh = 160;
	public static tileScreenSizeDownTh = 320;

	private unitsPerPixel: number;

	private canvasBoundsUnits: Bounds;
	private canvasRectPx: Rect;

	private planeBoundsUnits: Bounds;
	private planeRectUnits: Rect;

	constructor(planeBounds: Bounds) {
		this.planeBoundsUnits = bounds(planeBounds);
		this.planeRectUnits = boundsToRect(planeBounds);

		if (this.planeRectUnits.width != this.planeRectUnits.height) {
			throw new Error("Plane bounds need to form a square.");
		}

		this.canvasBoundsUnits = bounds();
		this.canvasRectPx = rect();

		this.unitsPerPixel = 0;
	}

	public initCanvas(canvasRect: Rect) {
		if (aspectRatio(canvasRect) >= 1) {
			this.unitsPerPixel = this.planeRectUnits.width / canvasRect.width;

			const cameraToPlaneHeight = this.unitsPerPixel * canvasRect.height;
			const complementaryPlane =
				this.planeRectUnits.height - cameraToPlaneHeight;

			this.canvasBoundsUnits = {
				minX: this.planeBoundsUnits.minX,
				maxX: this.planeBoundsUnits.maxX,
				minY: this.planeBoundsUnits.minY + complementaryPlane / 2,
				maxY: this.planeBoundsUnits.maxY - complementaryPlane / 2,
			};
		} else {
			this.unitsPerPixel = this.planeRectUnits.height / canvasRect.height;

			const cameraToPlaneWidth = this.unitsPerPixel * canvasRect.width;
			const complementaryPlane = this.planeRectUnits.width - cameraToPlaneWidth;

			this.canvasBoundsUnits = {
				minX: this.planeBoundsUnits.minX + complementaryPlane / 2,
				maxX: this.planeBoundsUnits.maxX - complementaryPlane / 2,
				minY: this.planeBoundsUnits.minY,
				maxY: this.planeBoundsUnits.maxY,
			};
		}

		this.canvasRectPx = rect(canvasRect);
	}

	public canvasCoordToCplane(x: number, y: number): [number, number] {
		return [this.canvasXToCplane(x), this.canvasYToCplane(y)];
	}

	public canvasXToCplane(x: number): number {
		return this.canvasBoundsUnits.minX + x * this.unitsPerPixel;
	}

	public canvasYToCplane(y: number): number {
		return this.canvasBoundsUnits.minY + y * this.unitsPerPixel;
	}

	public cplaneCoordToCanvas(x: number, y: number): [number, number] {
		return [this.cplaneXToCanvas(x), this.cplaneYToCanvas(y)];
	}

	public cplaneXToCanvas(x: number): number {
		return (x - this.canvasBoundsUnits.minX) / this.unitsPerPixel;
	}

	public cplaneYToCanvas(y: number): number {
		return (y - this.canvasBoundsUnits.minY) / this.unitsPerPixel;
	}

	private getSplitDepthLevel(): number {
		return Math.ceil(
			Math.log2(
				this.planeRectUnits.width /
					(this.unitsPerPixel * WorldScaler.texelsPerTile),
			),
		);
	}

	private tileUnitSizeFromDepthLevel(depthLevel: number): number {
		return this.planeRectUnits.width / Math.pow(2, depthLevel);
	}

	public tiles(): Tile[] {
		const tiles: Tile[] = [];
		const depthLevel = this.getSplitDepthLevel();
		const tileWidthUnits = this.tileUnitSizeFromDepthLevel(depthLevel);
		const tileWidthPx = tileWidthUnits / this.unitsPerPixel;

		const minXUnits = Math.floor(this.canvasBoundsUnits.minX / tileWidthUnits);
		const minYUnits = Math.floor(this.canvasBoundsUnits.minY / tileWidthUnits);

		const xmin = this.cplaneXToCanvas(minXUnits);
		const ymin = this.cplaneYToCanvas(minYUnits);

		const xmax = this.canvasRectPx.width;
		const ymax = this.canvasRectPx.height;

		for (let yPx = ymin; yPx < ymax; yPx += tileWidthPx) {
			for (let xPx = xmin; xPx < xmax; xPx += tileWidthPx) {
				tiles.push(new Tile(xPx, yPx, tileWidthPx));
			}
		}

		return tiles;
	}
}

const GridViewer: FC<GridViewerProps> = ({ cplaneBounds }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null!);
	const needDraw = useRef(false);
	const worldScaler = new WorldScaler(cplaneBounds);

	useLayoutEffect(() => {
		if (!canvasRef.current) {
			throw new Error("Canvas current is not set.");
		}

		const { width, height } = canvasRef.current.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		canvasRef.current.width = Math.round(width * dpr);
		canvasRef.current.height = Math.round(height * dpr);

		worldScaler.initCanvas(canvasRef.current);
		needDraw.current = true;
	}, []);

	function draw() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const W = canvas.width;
		const H = canvas.height;

		ctx.clearRect(0, 0, W, H);
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, W, H);

		ctx.strokeStyle = "#000";
		ctx.lineWidth = 1;

		for (const tile of worldScaler.tiles()) {
			ctx.beginPath();
			ctx.rect(tile.xPx, tile.yPx, tile.widthPx, tile.widthPx);
			ctx.stroke();
		}
	}

	useEffect(() => {
		function tick() {
			if (needDraw.current) {
				draw();
				needDraw.current = false;
			}
			requestAnimationFrame(tick);
		}
		tick();
	});

	return (
		<canvas
			ref={canvasRef}
			style={{
				width: "100%",
				height: "100%",
				display: "block",
				cursor: "grab",
			}}
		/>
	);
};

export default GridViewer;
