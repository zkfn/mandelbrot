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
export class PlaneGridHandler {
	private dirtyFlag: ReadAndClearFlag;

	private zoomFactor = 0.001;
	private camera: Camera;

	private lastPanCoord: [number, number];
	private isPanning: boolean;

	private dprQuery: MediaQueryList;
	private canvas: HTMLCanvasElement;
	private resizeObserver: ResizeObserver;

	public constructor(plane: Plane, flag: ReadAndClearFlag) {
		this.camera = new Camera(plane);
		// this.dirtyFlag = new ReadAndClearFlag(true);
		this.dirtyFlag = flag;

		this.canvas = null!;
		this.resizeObserver = null!;
		this.dprQuery = null!;

		this.lastPanCoord = [0, 0];
		this.isPanning = false;
	}

	public attachToCanvas(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.updateCanvasDimensions();

		canvas.addEventListener("wheel", this.handleWheel, { passive: false });
		canvas.addEventListener("mousedown", this.handleMouseDown);
		window.addEventListener("mousemove", this.handleMouseMove);
		window.addEventListener("mouseup", this.handleMouseUp);
		window.addEventListener("resize", this.updateCanvasDimensions);

		this.resizeObserver = new ResizeObserver(this.updateCanvasDimensions);
		this.resizeObserver.observe(this.canvas);

		this.hookOntoDPR();
	}

	public deattachFromCanvas() {
		this.canvas.removeEventListener("wheel", this.handleWheel);
		this.canvas.removeEventListener("mousedown", this.handleMouseDown);
		window.removeEventListener("mousemove", this.handleMouseMove);
		window.removeEventListener("mouseup", this.handleMouseUp);
		window.removeEventListener("resize", this.updateCanvasDimensions);

		this.resizeObserver.unobserve(this.canvas);
		this.resizeObserver.disconnect();

		this.unhookFromDPR();
	}

	private hookOntoDPR = () => {
		this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
		this.dprQuery.addEventListener("change", this.updateAndRehook, {
			once: true,
		});
	};

	private unhookFromDPR = () => {
		this.dprQuery.removeEventListener("change", this.updateAndRehook);
	};

	private updateAndRehook = () => {
		this.updateCanvasDimensions();
		this.hookOntoDPR();
	};

	private updateCanvasDimensions = () => {
		const bounding = this.canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		this.canvas.width = Math.round(bounding.width * dpr);
		this.canvas.height = Math.round(bounding.height * dpr);

		this.camera.adaptToDPR(dpr);
		this.camera.adaptToCanvas(this.canvas);
		this.dirtyFlag.set();
	};

	private handleMouseDown = (event: MouseEvent) => {
		event.preventDefault();

		this.lastPanCoord = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);

		this.canvas.style.cursor = "grabbing";
		this.isPanning = true;
		this.dirtyFlag.set();
	};

	private handleMouseMove = (event: MouseEvent) => {
		if (!this.isPanning) return;

		const [lastX, lastY] = this.lastPanCoord;
		const [cameraX, cameraY] = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);

		this.lastPanCoord = [cameraX, cameraY];

		const dx = lastX - cameraX;
		const dy = lastY - cameraY;

		this.camera.moveViewportByCameraPx(dx, dy);
		this.dirtyFlag.set();
	};

	private handleMouseUp = () => {
		this.canvas.style.cursor = "grab";
		this.isPanning = false;
	};

	private handleWheel = (event: WheelEvent) => {
		event.preventDefault();

		const factor = 2 ** (this.zoomFactor * event.deltaY);
		const [cameraX, cameraY] = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);

		this.camera.zoomViewportAtCameraPx(
			this.camera.getUPP() * factor,
			cameraX,
			cameraY,
		);

		this.dirtyFlag.set();
	};

	public optimalDepthLevelPerResolution(texelResolution: number): number {
		return this.camera.optimalDepthLevelPerResolution(texelResolution);
	}

	public getViewportBounds(): Bounds {
		return this.camera.viewportBounds();
	}

	public planeBoundsToCamera(bounds: Bounds): Bounds {
		return this.camera.planeBoundsToCamera(bounds);
	}
}
