import { useEffect, useLayoutEffect, useRef, type FC } from "react";
import { bounds, rect, type Bounds, type Rect } from "./bounds";
import { clamp } from "./utils";

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
 *  When dealing with GridViewer, there are 4 separate coordinate systems that
 *  need to be distinguished:
 *
 *  1) plane: Complex plane, measured simly in math _units_.
 *  2) canvas: Pixels referring precisely to _pixels_ on screen.
 *  3) camera: Pixels referring to _pixels_ inside canvas. This has to can be
 *             different from canvas, since some devices need to scale using
 *             DPR.
 *  4) tile: As we zoom in, finer and finer images are rendered. The unit of
 *           space that is being rendered each time is a tile. To distinguish
 *           pixels rendered per tile and pixel on the screen, the pixel of
 *           tile will be referred to as _texels_.
 */
class WorldScaler {
	private texelsResolution: number;
	private zoomFactor = 0.001;
	private dpr: number;

	private maxUnitsPerPixel: number;
	private minUnitsPerPixel: number;
	private unitsPerPixel: number;

	private cameraRectPixels: Rect;
	private cameraBoundsUnits: Bounds;
	private planeBoundsUnits: Bounds;

	private isPanning = false;
	private panLastXPixels = 0;
	private panLastYPixels = 0;

	private needsRedraw = false;
	private canvas: HTMLCanvasElement;

	constructor(planeBounds: Bounds, texelResolution: number = 256) {
		this.texelsResolution = texelResolution;
		this.dpr = window.devicePixelRatio || 1;

		this.planeBoundsUnits = bounds(planeBounds);

		if (this.planeWidthUnits() != this.planeHeightUnits()) {
			throw new Error("Plane bounds need to form a square.");
		}

		this.cameraRectPixels = rect();
		this.cameraBoundsUnits = bounds();
		this.canvas = null!;

		this.unitsPerPixel = 0;
		this.maxUnitsPerPixel = 0;
		this.minUnitsPerPixel = 2 ** -58;
	}

	public initCanvas(canvas: HTMLCanvasElement) {
		this.adaptCameraToCanvas(canvas);
		this.adaptMaxUnitPerPixel();
		this.upscaleAndCenter();

		canvas.addEventListener("wheel", this.handleWheel, { passive: true });
		canvas.addEventListener("mousedown", this.handleMouseDown);
		window.addEventListener("mousemove", this.handleMouseMove);
		window.addEventListener("mouseup", this.handleMouseUp);

		this.needsRedraw = true;
		this.canvas = canvas;
	}

	public deinitCanvas() {
		this.canvas.removeEventListener("wheel", this.handleWheel);
		this.canvas.removeEventListener("mousedown", this.handleMouseDown);
		window.removeEventListener("mousemove", this.handleMouseMove);
		window.removeEventListener("mouseup", this.handleMouseUp);
	}

	public adaptCameraToCanvas(canvas: HTMLCanvasElement) {
		const bounding = canvas.getBoundingClientRect();

		const cameraWidth = Math.round(bounding.width * this.dpr);
		const cameraHeight = Math.round(bounding.height * this.dpr);

		canvas.width = cameraWidth;
		canvas.height = cameraHeight;

		this.cameraRectPixels = {
			left: bounding.left,
			top: bounding.top,
			width: cameraWidth,
			height: cameraHeight,
		};
	}

	private adaptMaxUnitPerPixel() {
		const horizontalPPU = this.planeWidthUnits() / this.cameraRectPixels.width;
		const verticalPPU = this.planeHeightUnits() / this.cameraRectPixels.height;
		this.maxUnitsPerPixel = Math.max(horizontalPPU, verticalPPU);
	}

	private upscaleAndCenter() {
		this.unitsPerPixel = this.maxUnitsPerPixel;

		const spanX = this.unitsPerPixel * this.cameraRectPixels.width;
		const spanY = this.unitsPerPixel * this.cameraRectPixels.height;

		const cx = (this.planeBoundsUnits.minX + this.planeBoundsUnits.maxX) * 0.5;
		const cy = (this.planeBoundsUnits.minY + this.planeBoundsUnits.maxY) * 0.5;

		this.cameraBoundsUnits = {
			minX: cx - spanX * 0.5,
			maxX: cx + spanX * 0.5,
			minY: cy - spanY * 0.5,
			maxY: cy + spanY * 0.5,
		};
	}

	public handleMouseDown = (event: MouseEvent) => {
		event.preventDefault();

		const [planeX, planeY] = this.canvasToCameraPx(
			event.clientX,
			event.clientY,
		);

		this.panLastXPixels = planeX;
		this.panLastYPixels = planeY;

		this.isPanning = true;
		this.needsRedraw = true;
		this.canvas.style.cursor = "grabbing";
	};

	public handleMouseMove = (event: MouseEvent) => {
		event.preventDefault();

		if (!this.isPanning) return;

		const [planeX, planeY] = this.canvasToCameraPx(
			event.clientX,
			event.clientY,
		);

		const dxPixels = planeX - this.panLastXPixels;
		const dyPixels = planeY - this.panLastYPixels;

		this.panLastXPixels = planeX;
		this.panLastYPixels = planeY;

		const dxUnits = dxPixels * this.unitsPerPixel;
		const dyUnits = dyPixels * this.unitsPerPixel;

		this.cameraBoundsUnits = {
			minX: this.cameraBoundsUnits.minX - dxUnits,
			maxX: this.cameraBoundsUnits.maxX - dxUnits,
			minY: this.cameraBoundsUnits.minY - dyUnits,
			maxY: this.cameraBoundsUnits.maxY - dyUnits,
		};

		this.clampToOuterPlane();
		this.needsRedraw = true;
	};

	public handleMouseUp = () => {
		this.canvas.style.cursor = "grab";
		this.isPanning = false;
	};

	public handleWheel = (event: WheelEvent) => {
		const [px, py] = this.canvasToCameraPx(event.clientX, event.clientY);
		const [planeX, planeY] = this.cameraCoordToPlane(px, py);
		const factor = 2 ** (this.zoomFactor * event.deltaY);

		this.unitsPerPixel = clamp(
			this.minUnitsPerPixel,
			this.unitsPerPixel * factor,
			this.maxUnitsPerPixel,
		);

		const newWidthUnits = this.unitsPerPixel * this.cameraRectPixels.width;
		const newHeightUnits = this.unitsPerPixel * this.cameraRectPixels.height;

		const cameraWidthUnits =
			this.cameraBoundsUnits.maxX - this.cameraBoundsUnits.minX;
		const cameraHeightUnits =
			this.cameraBoundsUnits.maxY - this.cameraBoundsUnits.minY;

		const cursorHorizontalProportion =
			(planeX - this.cameraBoundsUnits.minX) / cameraWidthUnits;
		const cursorVerticalProportion =
			(planeY - this.cameraBoundsUnits.minY) / cameraHeightUnits;

		const minX = newWidthUnits * cursorHorizontalProportion;
		const minY = newHeightUnits * cursorVerticalProportion;

		const maxX = newWidthUnits - minX;
		const maxY = newHeightUnits - minY;

		this.cameraBoundsUnits = {
			minX: planeX - minX,
			maxX: planeX + maxX,
			minY: planeY - minY,
			maxY: planeY + maxY,
		};

		this.clampToOuterPlane();
		this.needsRedraw = true;
	};

	private clampToOuterPlane() {
		let { minX, minY } = this.cameraBoundsUnits;

		const width = this.cameraWidthUnits();
		const height = this.cameraHeightUnits();

		if (width > this.planeWidthUnits()) {
			const halfOverreach = (width - this.planeWidthUnits()) / 2;
			minX = this.planeBoundsUnits.minX - halfOverreach;
		} else {
			const maxMinX = this.planeBoundsUnits.maxX - width;
			if (minX < this.planeBoundsUnits.minX) minX = this.planeBoundsUnits.minX;
			if (minX > maxMinX) minX = maxMinX;
		}

		if (height > this.planeHeightUnits()) {
			const halfOverreach = (height - this.planeHeightUnits()) / 2;
			minY = this.planeBoundsUnits.minY - halfOverreach;
		} else {
			const maxMinY = this.planeBoundsUnits.maxY - height;
			if (minY < this.planeBoundsUnits.minY) minY = this.planeBoundsUnits.minY;
			if (minY > maxMinY) minY = maxMinY;
		}

		this.cameraBoundsUnits = {
			minX,
			maxX: minX + width,
			minY,
			maxY: minY + height,
		};
	}

	public tiles(): Tile[] {
		const tiles: Tile[] = [];

		const depthLevel = this.getSplitDepthLevel();
		const tileWidthUnits = this.tileUnitSizeFromDepthLevel(depthLevel);
		const tileWidthPx = tileWidthUnits / this.unitsPerPixel;

		const minXUnits = Math.floor(this.cameraBoundsUnits.minX / tileWidthUnits);
		const minYUnits = Math.floor(this.cameraBoundsUnits.minY / tileWidthUnits);

		const xmin = this.planeXToCamera(minXUnits * tileWidthUnits);
		const ymin = this.planeYToCamera(minYUnits * tileWidthUnits);

		const xmax = this.cameraRectPixels.width;
		const ymax = this.cameraRectPixels.height;

		for (let yPx = ymin; yPx < ymax; yPx += tileWidthPx) {
			for (let xPx = xmin; xPx < xmax; xPx += tileWidthPx) {
				tiles.push(new Tile(xPx, yPx, tileWidthPx));
			}
		}

		return tiles;
	}

	private canvasToCameraPx(clX: number, clY: number): [number, number] {
		const { top, left } = this.cameraRectPixels;

		const px = (clX - left) * this.dpr;
		const py = (clY - top) * this.dpr;

		return [px, py];
	}

	public readAndClearDrawFlag(): boolean {
		const previous = this.needsRedraw;
		this.needsRedraw = false;
		return previous;
	}

	public cameraCoordToPlane(x: number, y: number): [number, number] {
		return [this.cameraXToPlane(x), this.cameraYToPlane(y)];
	}

	public cameraXToPlane(x: number): number {
		return this.cameraBoundsUnits.minX + x * this.unitsPerPixel;
	}

	public cameraYToPlane(y: number): number {
		return this.cameraBoundsUnits.minY + y * this.unitsPerPixel;
	}

	public planeCoordToCamera(x: number, y: number): [number, number] {
		return [this.planeXToCamera(x), this.planeYToCamera(y)];
	}

	public planeXToCamera(x: number): number {
		return (x - this.cameraBoundsUnits.minX) / this.unitsPerPixel;
	}

	public planeYToCamera(y: number): number {
		return (y - this.cameraBoundsUnits.minY) / this.unitsPerPixel;
	}

	private getSplitDepthLevel(): number {
		return Math.ceil(
			Math.log2(
				this.planeWidthUnits() / (this.unitsPerPixel * this.texelsResolution),
			),
		);
	}

	private tileUnitSizeFromDepthLevel(depthLevel: number): number {
		return this.planeWidthUnits() / Math.pow(2, depthLevel);
	}

	private cameraWidthUnits() {
		return this.cameraBoundsUnits.maxX - this.cameraBoundsUnits.minX;
	}

	private cameraHeightUnits() {
		return this.cameraBoundsUnits.maxY - this.cameraBoundsUnits.minY;
	}

	private planeWidthUnits() {
		return this.planeBoundsUnits.maxX - this.planeBoundsUnits.minX;
	}

	private planeHeightUnits() {
		return this.planeBoundsUnits.maxY - this.planeBoundsUnits.minY;
	}
}

const GridViewer: FC<GridViewerProps> = ({ cplaneBounds }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null!);
	const worldScaler = new WorldScaler(cplaneBounds);

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

	useLayoutEffect(() => {
		if (!canvasRef.current) {
			throw new Error("Canvas current is not set.");
		}

		worldScaler.initCanvas(canvasRef.current);
		return () => worldScaler.deinitCanvas();
	}, []);

	useEffect(() => {
		function tick() {
			if (worldScaler.readAndClearDrawFlag()) {
				draw();
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
