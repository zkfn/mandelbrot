import { useEffect, useLayoutEffect, useRef, type FC } from "react";
import { bounds, boundsToRect, rect, type Bounds, type Rect } from "./bounds";
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
	private dpr: number;

	private maxUnitsPerPixel: number;
	private minUnitsPerPixel: number;
	private unitsPerPixel: number;

	private cameraRectUnits: Rect;
	private cameraRectPx: Rect;
	private canvasRectPx: Rect;

	private cameraBoundsUnits: Bounds;
	private planeBoundsUnits: Bounds;
	private planeRectUnits: Rect;

	constructor(planeBounds: Bounds, texelResolution: number = 256) {
		this.texelsResolution = texelResolution;
		this.dpr = window.devicePixelRatio || 1;

		this.planeBoundsUnits = bounds(planeBounds);
		this.planeRectUnits = boundsToRect(planeBounds);

		if (this.planeRectUnits.width != this.planeRectUnits.height) {
			throw new Error("Plane bounds need to form a square.");
		}

		this.canvasRectPx = rect();
		this.cameraRectPx = rect();
		this.cameraRectUnits = rect();
		this.cameraBoundsUnits = bounds();

		this.unitsPerPixel = 0;
		this.maxUnitsPerPixel = 0;
		this.minUnitsPerPixel = 2 ** -62;
	}

	public initCanvas(canvas: HTMLCanvasElement) {
		this.adaptCameraToCanvas(canvas);
		this.adaptMaxUnitPerPixel();
		this.upscaleAndCenter();
	}

	public adaptCameraToCanvas(canvas: HTMLCanvasElement) {
		const bounding = canvas.getBoundingClientRect();

		const cameraWidth = Math.round(bounding.width * this.dpr);
		const cameraHeight = Math.round(bounding.height * this.dpr);

		canvas.width = cameraWidth;
		canvas.height = cameraHeight;

		this.canvasRectPx = rect(bounding);
		this.cameraRectPx = {
			left: 0,
			top: 0,
			width: cameraWidth,
			height: cameraHeight,
		};
	}

	private adaptMaxUnitPerPixel() {
		const horizontalPPU = this.planeRectUnits.width / this.cameraRectPx.width;
		const verticalPPU = this.planeRectUnits.height / this.cameraRectPx.height;

		this.maxUnitsPerPixel = Math.max(horizontalPPU, verticalPPU);
	}

	private upscaleAndCenter() {
		this.unitsPerPixel = this.maxUnitsPerPixel;

		const spanX = this.unitsPerPixel * this.cameraRectPx.width;
		const spanY = this.unitsPerPixel * this.cameraRectPx.height;

		const cx = (this.planeBoundsUnits.minX + this.planeBoundsUnits.maxX) * 0.5;
		const cy = (this.planeBoundsUnits.minY + this.planeBoundsUnits.maxY) * 0.5;

		this.cameraBoundsUnits = {
			minX: cx - spanX * 0.5,
			maxX: cx + spanX * 0.5,
			minY: cy - spanY * 0.5,
			maxY: cy + spanY * 0.5,
		};

		this.cameraRectUnits = boundsToRect(this.cameraBoundsUnits);
	}

	public handleWheel(event: WheelEvent) {
		event.preventDefault();

		const [px, py] = this.canvasToCameraPx(event.clientX, event.clientY);
		const [ux, uy] = this.cameraCoordToPlane(px, py);

		const scale = event.deltaY < 0 ? 1 / 1.1 : 1.1;
		this.zoomAt(ux, uy, scale);
	}

	private zoomAt(planeX: number, planeY: number, scale: number) {
		this.unitsPerPixel = clamp(
			this.minUnitsPerPixel,
			this.unitsPerPixel * scale,
			this.maxUnitsPerPixel,
		);

		const newWidthUnits = this.unitsPerPixel * this.cameraRectPx.width;
		const newHeightUnits = this.unitsPerPixel * this.cameraRectPx.height;

		const cursorHorizontalProportion =
			(planeX - this.cameraRectUnits.left) / this.cameraRectUnits.width;
		const cursorVerticalProportion =
			(planeY - this.cameraRectUnits.top) / this.cameraRectUnits.height;

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

		this.cameraRectUnits = boundsToRect(this.cameraBoundsUnits);
		this.clampToOuterPlane();
	}

	private clampToOuterPlane() {
		let { minX, minY } = this.cameraBoundsUnits;

		if (this.cameraRectUnits.width > this.planeRectUnits.width) {
			minX =
				this.planeBoundsUnits.minX -
				(this.cameraRectUnits.width - this.planeRectUnits.width) / 2;
		} else {
			const maxMinX = this.planeBoundsUnits.maxX - this.cameraRectUnits.width;
			if (minX < this.planeBoundsUnits.minX) minX = this.planeBoundsUnits.minX;
			if (minX > maxMinX) minX = maxMinX;
		}

		if (this.cameraRectUnits.height > this.planeRectUnits.height) {
			minY =
				this.planeBoundsUnits.minY -
				(this.cameraRectUnits.height - this.planeRectUnits.height) / 2;
		} else {
			const maxMinY = this.planeBoundsUnits.maxY - this.cameraRectUnits.height;
			if (minY < this.planeBoundsUnits.minY) minY = this.planeBoundsUnits.minY;
			if (minY > maxMinY) minY = maxMinY;
		}

		this.cameraBoundsUnits = {
			minX,
			maxX: minX + this.cameraRectUnits.width,
			minY,
			maxY: minY + this.cameraRectUnits.height,
		};

		this.cameraRectUnits = boundsToRect(this.cameraBoundsUnits);
	}

	private canvasToCameraPx(clX: number, clY: number): [number, number] {
		const { top, left } = this.canvasRectPx;

		const px = (clX - left) * this.dpr;
		const py = (clY - top) * this.dpr;

		return [px, py];
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
				this.planeRectUnits.width /
					(this.unitsPerPixel * this.texelsResolution),
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

		const minXUnits = Math.floor(this.cameraBoundsUnits.minX / tileWidthUnits);
		const minYUnits = Math.floor(this.cameraBoundsUnits.minY / tileWidthUnits);

		const xmin = this.planeXToCamera(minXUnits * tileWidthUnits);
		const ymin = this.planeYToCamera(minYUnits * tileWidthUnits);

		const xmax = this.cameraRectPx.width;
		const ymax = this.cameraRectPx.height;

		for (let yPx = ymin; yPx < ymax; yPx += tileWidthPx) {
			for (let xPx = xmin; xPx < xmax; xPx += tileWidthPx) {
				tiles.push(new Tile(xPx, yPx, tileWidthPx));
			}
		}

		console.log(depthLevel);
		console.dir(this);
		return tiles;
	}
}

const GridViewer: FC<GridViewerProps> = ({ cplaneBounds }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null!);
	const needDraw = useRef(false);
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
		canvasRef.current.addEventListener(
			"wheel",
			(e) => {
				worldScaler.handleWheel(e);
				needDraw.current = true;
			},
			// { passive: true },
		);
		needDraw.current = true;
	}, []);

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
