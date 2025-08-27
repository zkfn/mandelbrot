import { ReadAndClearFlag } from "@common/flag";
import { Camera } from "@lib/camera";
import type { Bounds, Plane } from "@common/types";

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

	private camera: Camera;

	private isPanning = false;
	private panLastXPixels = 0;
	private panLastYPixels = 0;
	private invalidateFlag: ReadAndClearFlag;

	private canvas: HTMLCanvasElement;
	private resizeObserver: ResizeObserver;

	public constructor(plane: Plane, invalidateFlag: ReadAndClearFlag) {
		this.camera = new Camera(plane);
		this.canvas = null!;
		this.resizeObserver = null!;
		this.invalidateFlag = invalidateFlag;
	}

	public initCanvas(canvas: HTMLCanvasElement) {
		const bounding = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		const cameraWidth = Math.round(bounding.width * dpr);
		const cameraHeight = Math.round(bounding.height * dpr);

		canvas.width = cameraWidth;
		canvas.height = cameraHeight;

		this.camera.adaptToCanvas(canvas);
		this.camera.adaptToDPR(dpr);

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

	public handleMouseDown = (event: MouseEvent) => {
		event.preventDefault();

		const [cameraX, cameraY] = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);

		this.panLastXPixels = cameraX;
		this.panLastYPixels = cameraY;

		this.isPanning = true;
		this.canvas.style.cursor = "grabbing";
		this.invalidateFlag.set();
	};

	public handleMouseMove = (event: MouseEvent) => {
		if (!this.isPanning) return;

		const [cameraX, cameraY] = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);

		const dx = this.panLastXPixels - cameraX;
		const dy = this.panLastYPixels - cameraY;

		this.panLastXPixels = cameraX;
		this.panLastYPixels = cameraY;

		this.camera.moveViewportByCameraPx(dx, dy);
		this.invalidateFlag.set();
	};

	public handleMouseUp = () => {
		this.canvas.style.cursor = "grab";
		this.isPanning = false;
	};

	public handleWheel = (event: WheelEvent) => {
		event.preventDefault();

		const [cameraX, cameraY] = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);
		const factor = 2 ** (this.zoomFactor * event.deltaY);

		this.camera.zoomViewportAtCameraPx(
			this.camera.getUPP() * factor,
			cameraX,
			cameraY,
		);

		this.invalidateFlag.set();
	};

	public optimalDepthLevelPerResolution(texelResolution: number): number {
		return this.camera.optimalDepthLevelPerResolution(texelResolution);
	}

	public handleResize = () => {
		this.camera.adaptToCanvas(this.canvas);
		this.invalidateFlag.set();
	};

	public getViewportBounds(): Bounds {
		return this.camera.viewportBounds();
	}

	public planeBoundsToCamera(bounds: Bounds): Bounds {
		return this.camera.planeBoundsToCamera(bounds);
	}
}
