import { rect, clamp, planeToBounds } from "@common/utils";
import { ReadAndClearFlag } from "@common/flag";
import type { Bounds, Rect, Plane } from "@common/types";
import { Viewport } from "@lib/viewport";

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
export class PlaneGrid {
	private zoomFactor = 0.001;
	private dpr: number;

	private viewport: Viewport;

	private maxUnitsPerPixel: number;
	private minUnitsPerPixel: number;
	private unitsPerPixel: number;

	private cameraRectPixels: Rect;
	private planeBoundsUnits: Bounds;

	private isPanning = false;
	private panLastXPixels = 0;
	private panLastYPixels = 0;
	private invalidateFlag: ReadAndClearFlag;

	private canvas: HTMLCanvasElement;
	private resizeObserver: ResizeObserver;

	public constructor(plane: Plane, invalidateFlag: ReadAndClearFlag) {
		this.dpr = window.devicePixelRatio || 1;
		this.planeBoundsUnits = planeToBounds(plane);

		if (this.planeWidthUnits() != this.planeHeightUnits()) {
			throw new Error("Plane bounds need to form a square.");
		}

		this.viewport = new Viewport(plane);
		this.cameraRectPixels = rect();

		this.canvas = null!;
		this.resizeObserver = null!;
		this.invalidateFlag = invalidateFlag;

		this.unitsPerPixel = 0;
		this.maxUnitsPerPixel = 0;
		this.minUnitsPerPixel = 2 ** -58;
	}

	public initCanvas(canvas: HTMLCanvasElement) {
		this.adaptCameraToCanvas(canvas);
		this.adaptMaxUnitPerPixel();
		this.upscaleAndCenter();

		canvas.addEventListener("wheel", this.handleWheel, { passive: false });
		canvas.addEventListener("mousedown", this.handleMouseDown);
		window.addEventListener("mousemove", this.handleMouseMove);
		window.addEventListener("mouseup", this.handleMouseUp);
		window.addEventListener("resize", this.handleResize);

		this.canvas = canvas;

		this.resizeObserver = new ResizeObserver(this.handleResize);
		this.resizeObserver.observe(this.canvas);
	}

	public deinitCanvas() {
		this.canvas.removeEventListener("wheel", this.handleWheel);
		this.canvas.removeEventListener("mousedown", this.handleMouseDown);
		window.removeEventListener("mousemove", this.handleMouseMove);
		window.removeEventListener("mouseup", this.handleMouseUp);
		window.removeEventListener("resize", this.handleResize);
		this.resizeObserver.disconnect();
	}

	public adaptCameraToCanvas(canvas: HTMLCanvasElement) {
		const bounding = canvas.getBoundingClientRect();

		const cameraWidth = Math.round(bounding.width * this.dpr);
		const cameraHeight = Math.round(bounding.height * this.dpr);

		canvas.width = cameraWidth;
		canvas.height = cameraHeight;

		this.cameraRectPixels = {
			width: cameraWidth,
			height: cameraHeight,
		};
	}

	private adaptMaxUnitPerPixel() {
		const horizontalPPU = this.planeWidthUnits() / this.cameraRectPixels.width;
		const verticalPPU = this.planeHeightUnits() / this.cameraRectPixels.height;

		this.maxUnitsPerPixel = Math.max(horizontalPPU, verticalPPU);
		this.unitsPerPixel = this.maxUnitsPerPixel;
	}

	private upscaleAndCenter() {
		this.viewport.resize(this.viewportSpanX(), this.viewportSpanY());
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
		this.invalidateFlag.set();
		this.canvas.style.cursor = "grabbing";
	};

	public handleMouseMove = (event: MouseEvent) => {
		if (!this.isPanning) return;

		const [planeX, planeY] = this.canvasToCameraPx(
			event.clientX,
			event.clientY,
		);

		const dxPixels = planeX - this.panLastXPixels;
		const dyPixels = planeY - this.panLastYPixels;

		this.panLastXPixels = planeX;
		this.panLastYPixels = planeY;

		const dxUnits = -dxPixels * this.unitsPerPixel;
		const dyUnits = -dyPixels * this.unitsPerPixel;

		this.viewport.moveBy(dxUnits, dyUnits);
		this.invalidateFlag.set();
	};

	public handleMouseUp = () => {
		this.canvas.style.cursor = "grab";
		this.isPanning = false;
	};

	public handleWheel = (event: WheelEvent) => {
		event.preventDefault();

		const [px, py] = this.canvasToCameraPx(event.clientX, event.clientY);
		const zoomAround = this.cameraCoordToPlane(px, py);

		const factor = 2 ** (this.zoomFactor * event.deltaY);

		this.unitsPerPixel = clamp(
			this.minUnitsPerPixel,
			this.unitsPerPixel * factor,
			this.maxUnitsPerPixel,
		);

		this.viewport.resize(
			this.viewportSpanX(),
			this.viewportSpanY(),
			zoomAround,
		);
		this.invalidateFlag.set();
	};

	public handleResize = () => {
		const oldUPP = this.unitsPerPixel;

		this.adaptCameraToCanvas(this.canvas);
		this.adaptMaxUnitPerPixel();

		this.unitsPerPixel = clamp(
			this.minUnitsPerPixel,
			oldUPP,
			this.maxUnitsPerPixel,
		);

		this.viewport.resize(this.viewportSpanX(), this.viewportSpanY());
		this.invalidateFlag.set();
	};

	private canvasToCameraPx(clX: number, clY: number): [number, number] {
		const { top, left } = this.canvas.getBoundingClientRect();

		const px = (clX - left) * this.dpr;
		const py = (clY - top) * this.dpr;

		return [px, py];
	}

	public getCameraBounds(): Bounds {
		return this.viewport.bounds();
	}

	public cameraCoordToPlane(x: number, y: number): [number, number] {
		return [this.cameraXToPlane(x), this.cameraYToPlane(y)];
	}

	public cameraXToPlane(x: number): number {
		return this.viewport.minX() + x * this.unitsPerPixel;
	}

	public cameraYToPlane(y: number): number {
		return this.viewport.minY() + y * this.unitsPerPixel;
	}

	public planeCoordToCamera(x: number, y: number): [number, number] {
		return [this.planeXToCamera(x), this.planeYToCamera(y)];
	}

	public planeXToCamera(x: number): number {
		return (x - this.viewport.minX()) / this.unitsPerPixel;
	}

	public planeYToCamera(y: number): number {
		return (y - this.viewport.minY()) / this.unitsPerPixel;
	}

	public optimalDepthLevelPerResolution(texelResolution: number): number {
		return Math.ceil(
			Math.log2(
				this.planeWidthUnits() / (this.unitsPerPixel * texelResolution),
			),
		);
	}

	public planeBoundsToCamera(bounds: Bounds): Bounds {
		const [minX, minY] = this.planeCoordToCamera(bounds.minX, bounds.minY);
		const [maxX, maxY] = this.planeCoordToCamera(bounds.maxX, bounds.maxY);
		return {
			minX,
			minY,
			maxX,
			maxY,
		};
	}

	private planeWidthUnits() {
		return this.planeBoundsUnits.maxX - this.planeBoundsUnits.minX;
	}

	private planeHeightUnits() {
		return this.planeBoundsUnits.maxY - this.planeBoundsUnits.minY;
	}

	// TODO rename this
	private viewportSpanX(): number {
		return this.cameraRectPixels.width * this.unitsPerPixel;
	}

	// TODO rename this
	private viewportSpanY(): number {
		return this.cameraRectPixels.height * this.unitsPerPixel;
	}
}
