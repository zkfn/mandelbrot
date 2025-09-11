import { Camera } from "@lib/camera";
import { Composer } from "./composer";
import { TSSupervisor } from "./supervisors/ts-supervisor";
import { JobQueue } from "./queue";
import { TileStore } from "./store";
import { BitmapPainter, type BitmapResult } from "./painters/bitmap-painter";
import type { Plane } from "@common/types";
import { atom, createStore, useAtom } from "jotai";
import type { PrimitiveAtom } from "jotai";
import type { Store } from "jotai/vanilla/store";

export class PlaneGridHandler {
	private readonly zoomFactor = 0.001;
	private readonly plane: Plane;

	private poolSize: PrimitiveAtom<number>;
	private resolution: PrimitiveAtom<number>;
	readonly store: Store;

	private composer: Composer<TSSupervisor> | null;
	private jobQueue: JobQueue<TSSupervisor> | null;
	private tilePainter: BitmapPainter;
	private tileStore: TileStore<BitmapResult>;
	private camera: Camera;

	private lastPanCoord: [number, number];
	private isPanning: boolean;

	private dprQuery: MediaQueryList;
	private canvas: HTMLCanvasElement;
	private resizeObserver: ResizeObserver;
	private rafNumber: number;

	public constructor(plane: Plane) {
		this.plane = plane;

		this.camera = null!;
		this.tilePainter = null!;
		this.tileStore = null!;
		this.jobQueue = null!;

		// TODO this should have meaningful defaults
		// and should be configurable via props.
		this.poolSize = atom(7);
		this.resolution = atom(128);
		this.store = createStore();

		this.composer = null;

		this.dprQuery = null!;
		this.canvas = null!;
		this.rafNumber = 0;

		this.lastPanCoord = [0, 0];
		this.isPanning = false;

		this.resizeObserver = new ResizeObserver(this.updateCanvasDimensions);
	}

	public attachToCanvas(canvas: HTMLCanvasElement) {
		this.canvas = canvas;

		this.tilePainter = new BitmapPainter();
		this.camera = new Camera(this.plane);
		this.tileStore = new TileStore({});

		this.jobQueue = new JobQueue(new TSSupervisor(), this.tileStore, {
			poolSize: this.store.get(this.poolSize),
		});

		this.composer = new Composer(
			this.plane,
			this.tileStore,
			this.jobQueue,
			this.tilePainter,
			this.camera,
			this.store.get(this.resolution),
		);

		this.tilePainter.setCanvas(this.canvas);
		this.tilePainter.setCamera(this.camera);

		this.resizeObserver.observe(canvas);

		canvas.addEventListener("wheel", this.handleWheel, { passive: false });
		canvas.addEventListener("mousedown", this.handleMouseDown);
		window.addEventListener("mousemove", this.handleMouseMove);
		window.addEventListener("mouseup", this.handleMouseUp);
		window.addEventListener("resize", this.updateCanvasDimensions);

		this.rafNumber = requestAnimationFrame(this.tick);

		this.updateCanvasDimensions();
		this.hookOntoDPR();
		this.setDefaultPointerStyle();
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
		this.rafNumber = 0;

		this.composer?.dispose();
		this.jobQueue?.dispose();
		this.tileStore?.dispose();
	}

	public usePoolSize = (): [number, (poolSize: number) => void] => {
		const [poolSize, setPoolSize] = useAtom(this.poolSize);
		return [
			poolSize,
			(newPoolSize: number) => {
				setPoolSize(newPoolSize);
				if (this.jobQueue !== null) {
					this.jobQueue.setPoolSize(newPoolSize);
				}
			},
		];
	};

	public useResolution = (): [number, (resolution: number) => void] => {
		const [resolution, setResolution] = useAtom(this.resolution);
		return [
			resolution,
			(newResolution: number) => {
				setResolution(newResolution);
				if (this.composer !== null) {
					this.composer.setResolution(newResolution);
				}
			},
		];
	};

	public getWorkerBusyness(): boolean[] | null {
		if (this.jobQueue !== null) {
			return this.jobQueue.getWorkerBusyness();
		} else {
			return null;
		}
	}

	private tick = () => {
		this.composer?.draw();
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
