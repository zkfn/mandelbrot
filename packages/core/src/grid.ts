import type { Plane } from "@mandelbrot/common/types";
import { bindAtom } from "@mandelbrot/common/utils";
import { Camera } from "@mandelbrot/core";
import TSWorker from "@mandelbrot/workers/workers/ts_worker.ts?worker";
import WASMWorker from "@mandelbrot/workers/workers/wasm_zig_worker.ts?worker";
import type { PrimitiveAtom } from "jotai";
import { createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Store } from "jotai/vanilla/store";
import { createBitmapOrchestrator } from "./datastructs/bitmaps";
import type Orchestrator from "./datastructs/orchestrator";
import { resolutionValues } from "./resolution";

const modesToWorkers = {
	ts: TSWorker,
	zig: WASMWorker,
};

export const modes = Object.keys(modesToWorkers);

export type Mode = keyof typeof modesToWorkers;

export class PlaneGridHandler {
	private readonly zoomFactor = 0.001;
	private readonly plane: Plane;

	// TODO turn this into observables == make it independent of Jotai
	public readonly maxIterations: PrimitiveAtom<number>;
	public readonly poolSize: PrimitiveAtom<number>;
	public readonly resolution: PrimitiveAtom<number>;
	public readonly mode: PrimitiveAtom<Mode>;
	public readonly store: Store;

	private poolSizeUnsub: () => void;
	private resolutionUnsub: () => void;
	private maxIterationsUnsub: () => void;
	private modeUnsub: () => void;

	private camera: Camera;
	private orchestrator: Orchestrator<ImageBitmap, ArrayBufferLike>;

	private lastPanCoord: [number, number];
	private isPanning: boolean;

	private dprQuery: MediaQueryList;
	private canvas: HTMLCanvasElement;
	private resizeObserver: ResizeObserver;
	private rafNumber: number;

	public constructor(plane: Plane) {
		this.plane = plane;

		this.camera = null!;
		this.orchestrator = null!;

		this.poolSizeUnsub = null!;
		this.resolutionUnsub = null!;
		this.maxIterationsUnsub = null!;
		this.modeUnsub = null!;

		// TODO this should have meaningful defaults
		// and should be configurable via props.
		this.poolSize = atomWithStorage("poolSize", 7);
		this.resolution = atomWithStorage("resolution", resolutionValues[0]);
		this.maxIterations = atomWithStorage("maxIterations", 500);
		this.mode = atomWithStorage("mode", "ts" as Mode);
		this.store = createStore();

		this.dprQuery = null!;
		this.canvas = null!;
		this.rafNumber = 0;

		this.lastPanCoord = [0, 0];
		this.isPanning = false;

		// TODO: new canvas dimensions after resize are not calculated properly
		// as 100% of the bouding box.
		this.resizeObserver = new ResizeObserver(this.updateCanvasDimensions);
	}

	public attachToCanvas(canvas: HTMLCanvasElement) {
		this.canvas = canvas;

		this.camera = new Camera(this.plane);
		this.orchestrator = createBitmapOrchestrator(
			WASMWorker,
			canvas,
			this.camera,
			{
				poolSize: this.store.get(this.poolSize),
				tileSize: this.store.get(this.resolution),
				maxIters: this.store.get(this.maxIterations),
			},
		);

		this.poolSizeUnsub = bindAtom(
			this.store,
			this.poolSize,
			this.updatePoolSize,
		);

		this.resolutionUnsub = bindAtom(
			this.store,
			this.resolution,
			this.updateResolution,
		);

		this.maxIterationsUnsub = bindAtom(
			this.store,
			this.maxIterations,
			this.updateMaxIterations,
		);

		this.modeUnsub = bindAtom(this.store, this.mode, this.updateMode);

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

		this.poolSizeUnsub();
		this.resolutionUnsub();
		this.maxIterationsUnsub();
		this.modeUnsub();

		this.orchestrator.dispose();
	}

	public updateMode = () => {};

	public getMode = () => {
		return this.mode;
	};

	public updatePoolSize = (poolSize: number): void => {
		if (this.orchestrator !== null) {
			this.orchestrator.setPoolSize(poolSize);
		}
	};

	private updateResolution = (resolution: number): void => {
		if (this.orchestrator !== null) {
			this.orchestrator.setTileSize(resolution);
		}
	};

	private updateMaxIterations = (iterations: number): void => {
		if (this.orchestrator !== null) {
			this.orchestrator.setMaxIterations(iterations);
		}
	};

	public getWorkerBusyness(): boolean[] | null {
		if (this.orchestrator !== null) {
			return this.orchestrator.getWorkerBusyness();
		} else {
			return null;
		}
	}

	public getQueueSize(): number | null {
		if (this.orchestrator !== null) {
			return this.orchestrator.getQueueSize();
		} else {
			return null;
		}
	}

	// TOOD this
	public getRenderTimePerTile(): number | null {
		/* if (this.jobQueue !== null) {
			return this.jobQueue.getRenderTimePerTile();
		} else {
			return null;
		} */

		return null;
	}

	private tick = () => {
		this.orchestrator?.update();
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
