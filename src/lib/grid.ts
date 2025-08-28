import { Camera } from "@lib/camera";
import type { Plane } from "@common/types";
import { TilePainter } from "./painter";

export class PlaneGridHandler {
	private zoomFactor = 0.001;
	private plane: Plane;
	private rafNumber: number;

	private camera: Camera;
	private tilePainter: TilePainter;

	private lastPanCoord: [number, number];
	private isPanning: boolean;

	private dprQuery: MediaQueryList;
	private canvas: HTMLCanvasElement;
	private resizeObserver: ResizeObserver;

	public constructor(plane: Plane) {
		this.plane = plane;
		this.camera = new Camera(plane);
		this.tilePainter = null!;

		this.canvas = null!;
		this.resizeObserver = null!;
		this.dprQuery = null!;

		this.lastPanCoord = [0, 0];
		this.isPanning = false;
		this.rafNumber = 0;
	}

	public attachToCanvas(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.tilePainter = new TilePainter(this.plane, canvas, this.camera);
		this.updateCanvasDimensions();

		canvas.addEventListener("wheel", this.handleWheel, { passive: false });
		canvas.addEventListener("mousedown", this.handleMouseDown);
		window.addEventListener("mousemove", this.handleMouseMove);
		window.addEventListener("mouseup", this.handleMouseUp);
		window.addEventListener("resize", this.updateCanvasDimensions);

		this.resizeObserver = new ResizeObserver(this.updateCanvasDimensions);
		this.resizeObserver.observe(this.canvas);

		this.hookOntoDPR();
		this.setDefaultPointerStyle();

		this.rafNumber = requestAnimationFrame(this.tick);
	}

	public deattachFromCanvas() {
		cancelAnimationFrame(this.rafNumber);

		this.canvas.removeEventListener("wheel", this.handleWheel);
		this.canvas.removeEventListener("mousedown", this.handleMouseDown);
		window.removeEventListener("mousemove", this.handleMouseMove);
		window.removeEventListener("mouseup", this.handleMouseUp);
		window.removeEventListener("resize", this.updateCanvasDimensions);

		this.resizeObserver.unobserve(this.canvas);
		this.resizeObserver.disconnect();

		this.unhookFromDPR();

		this.canvas = null!;
		this.tilePainter.clear();
		this.rafNumber = 0;
	}

	private tick = () => {
		this.tilePainter.draw();
		this.rafNumber = requestAnimationFrame(this.tick);
	};

	private hookOntoDPR = () => {
		this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
		this.dprQuery.addEventListener("change", this.updateAndRehook, {
			once: true,
		});
	};

	private unhookFromDPR = () => {
		this.dprQuery.removeEventListener("change", this.updateAndRehook);
		this.dprQuery = null!;
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
		this.tilePainter.forceRedraw();
	};

	private handleMouseDown = (event: MouseEvent) => {
		event.preventDefault();

		this.lastPanCoord = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);

		this.setGrabbingPointerStyle();
		this.tilePainter.forceRedraw();
		this.isPanning = true;
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
		this.tilePainter.forceRedraw();
	};

	private handleMouseUp = () => {
		this.setDefaultPointerStyle();
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

		this.tilePainter.forceRedraw();
	};

	private setDefaultPointerStyle() {
		this.canvas.style.cursor = "crosshair";
	}

	private setGrabbingPointerStyle() {
		this.canvas.style.cursor = "grabbing";
	}
}
