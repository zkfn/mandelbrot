import { Camera } from "@lib/camera";
import type { Plane } from "@common/types";
import { TilePainter } from "./painter";
import { Composer } from "./composer";

export class PlaneGridHandler {
	private zoomFactor = 0.001;
	private plane: Plane;
	private composer: Composer;
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
		this.composer = null!;

		this.lastPanCoord = [0, 0];
		this.isPanning = false;
		this.rafNumber = 0;
	}

	public attachToCanvas(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.tilePainter = new TilePainter(canvas);
		this.composer = new Composer(this.plane, this.tilePainter, this.camera);
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
		this.composer.dispose();
		this.rafNumber = 0;
	}

	private tick = () => {
		this.composer.draw();
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
	};

	private handleMouseDown = (event: MouseEvent) => {
		event.preventDefault();

		this.lastPanCoord = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);

		this.setGrabbingPointerStyle();
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
	};

	private setDefaultPointerStyle() {
		this.canvas.style.cursor = "crosshair";
	}

	private setGrabbingPointerStyle() {
		this.canvas.style.cursor = "grabbing";
	}
}
