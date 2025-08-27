import { ReadAndClearFlag } from "@common/flag";
import { Camera } from "@lib/camera";
import { Tile, TileSetter, TileState, ViewCornerTiles } from "./tiles";
import { boundsToRect } from "@common/utils";
import { TileStore } from "./store";
import { TileJobQueue } from "./queue";
import { WorkerExecutor } from "./executor";
import type { Plane } from "@common/types";

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
	private zoomFactor = 0.001;

	private camera: Camera;
	private tileSetter: TileSetter;
	private tileStore: TileStore;
	private tileQueue: TileJobQueue;
	private previousTiles: ViewCornerTiles | null;
	private dirtyFlag: ReadAndClearFlag;
	private executor: WorkerExecutor;

	private lastPanCoord: [number, number];
	private isPanning: boolean;

	private dprQuery: MediaQueryList;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private resizeObserver: ResizeObserver;

	public constructor(plane: Plane) {
		this.camera = new Camera(plane);
		this.tileSetter = new TileSetter(plane);
		this.tileStore = new TileStore();
		this.tileQueue = new TileJobQueue();
		this.dirtyFlag = new ReadAndClearFlag(true);
		this.executor = new WorkerExecutor(
			this.tileStore,
			this.tileQueue,
			this.dirtyFlag,
		);

		this.previousTiles = null;
		this.canvas = null!;
		this.resizeObserver = null!;
		this.dprQuery = null!;
		this.ctx = null!;

		this.lastPanCoord = [0, 0];
		this.isPanning = false;
	}

	public draw() {
		if (!this.dirtyFlag.readAndClear()) return;
		this.clearCanvas();

		function colorFor(state: TileState): string {
			if (state === TileState.READY) return "#0f0";
			if (state === TileState.RENDERING) return "#ff4";
			else return "#aa0";
		}

		const paintTiles = (tiles: Tile[]) => {
			for (const tile of tiles) {
				const camBounds = this.camera.planeBoundsToCamera(tile.section);

				const { minX, minY } = camBounds;
				const { width, height } = boundsToRect(camBounds);

				const record = this.tileStore.getTileRecord(tile.key.id());

				if (record && record.state != TileState.QUEUED) {
					this.ctx.fillStyle = colorFor(record.state);
					this.ctx.fillRect(minX, minY, width, height);
					this.ctx.strokeRect(minX, minY, width, height);
				}
			}
		};

		const processTiles = (tiles: Tile[]) => {
			for (const tile of tiles) {
				const record = this.tileStore.getTileRecord(tile.key.id());

				if (!record || record.state == TileState.QUEUED) {
					this.tileQueue.push(tile);
					this.tileStore.setQueued(tile.key.id());
				}
			}
		};

		const desiredDepth = this.camera.optimalDepthLevelPerResolution(256);
		const coarserDepth = desiredDepth - 1;
		const blurDepth = desiredDepth - 2;

		const bounds = this.camera.viewportBounds();
		const cornerTiles = this.tileSetter.cornerTiles(bounds, desiredDepth);

		const desiredTiles = this.tileSetter.layTiles(cornerTiles);

		const coarserTiles = this.tileSetter.layTiles(
			this.tileSetter.cornerTiles(bounds, coarserDepth),
		);

		const blurTiles = this.tileSetter.layTiles(
			this.tileSetter.cornerTiles(bounds, blurDepth),
		);

		if (!this.previousTiles || !this.previousTiles.isSameAs(cornerTiles)) {
			this.previousTiles = cornerTiles;
			this.tileQueue.nextGeneration();
			this.tileStore.prune();

			processTiles(blurTiles);
			processTiles(coarserTiles);
			processTiles(desiredTiles);

			this.executor.pump();
			console.log("Updated Jobs");
		}

		paintTiles(blurTiles);
		paintTiles(coarserTiles);
		paintTiles(desiredTiles);
	}

	private clearCanvas() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.fillStyle = "#fff";
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.strokeStyle = "#000";
		this.ctx.lineWidth = 1;
	}

	public attachToCanvas(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");

		if (!ctx) {
			throw Error("Canvas context is empty.");
		}

		this.ctx = ctx;
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
		this.setDefaultPointerStyle();
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

		this.canvas = null!;
		this.ctx = null!;

		// TODO clear queue and store
	}

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
		this.dirtyFlag.set();
	};

	private handleMouseDown = (event: MouseEvent) => {
		event.preventDefault();

		this.lastPanCoord = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);

		this.setGrabbingPointerStyle();
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

		this.dirtyFlag.set();
	};

	private setDefaultPointerStyle() {
		this.canvas.style.cursor = "crosshair";
	}

	private setGrabbingPointerStyle() {
		this.canvas.style.cursor = "grabbing";
	}
}
