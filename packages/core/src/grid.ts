import type { Unsubscribe } from "@mandelbrot/common";
import type { Plane } from "@mandelbrot/common/types";
import { determineDefaultPoolSize } from "@mandelbrot/workers";
import TSWorker from "@mandelbrot/workers/workers/ts_worker.ts?worker";
import WASMWorker from "@mandelbrot/workers/workers/wasm_zig_worker.ts?worker";
import type { Atom, PrimitiveAtom } from "jotai";
import { createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Store } from "jotai/vanilla/store";
import { createBitmapOrchestrator } from "../../core/src/bitmaps";
import Camera from "../../core/src/camera";
import { GridEventHandler } from "../../core/src/events";
import type Orchestrator from "../../core/src/orchestrator";
import type { OrchestratorProps } from "../../core/src/orchestrator";

export const bindAtom = <T>(
	store: Store,
	atom: Atom<T>,
	apply: (value: T) => void,
): (() => void) => {
	apply(store.get(atom));
	return store.sub(atom, () => apply(store.get(atom)));
};

const orchestrators = {
	js: (canvas: HTMLCanvasElement, camera: Camera, props?: OrchestratorProps) =>
		createBitmapOrchestrator(TSWorker, canvas, camera, props),
	wasm: (
		canvas: HTMLCanvasElement,
		camera: Camera,
		props?: OrchestratorProps,
	) => createBitmapOrchestrator(WASMWorker, canvas, camera, props),
};

export const orchestratorNames: OrchestratorName[] = Object.keys(
	orchestrators,
) as OrchestratorName[];

export type OrchestratorName = keyof typeof orchestrators;

export class Grid {
	private events: GridEventHandler;
	private camera: Camera;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public orchestrator: Orchestrator<any, any>;

	public readonly maxIters: PrimitiveAtom<number>;
	public readonly poolSize: PrimitiveAtom<number>;
	public readonly tileSize: PrimitiveAtom<number>;
	public readonly orchestratorName: PrimitiveAtom<OrchestratorName>;
	public readonly store: Store;

	private unsubs: Unsubscribe[];
	private rafNumber: number;
	private canvas: HTMLCanvasElement;

	public constructor(
		plane: Plane,
		canvas: HTMLCanvasElement,
		wrapper: HTMLDivElement,
	) {
		this.canvas = canvas;
		this.camera = new Camera(plane);
		this.events = new GridEventHandler(this.camera, canvas, wrapper);
		this.rafNumber = requestAnimationFrame(this.tick);

		this.store = createStore();
		this.poolSize = atomWithStorage(
			"poolSize",
			determineDefaultPoolSize(),
			undefined,
		);

		this.tileSize = atomWithStorage("tileSize", 256);

		this.maxIters = atomWithStorage("maxIters", 500);

		this.orchestratorName = atomWithStorage("mode", "wasm" as OrchestratorName);

		this.orchestrator = this.getOrchestrator();

		this.unsubs = [
			bindAtom(this.store, this.tileSize, (v) =>
				this.orchestrator.setTileSize(v),
			),
			bindAtom(this.store, this.maxIters, (v) =>
				this.orchestrator.setMaxIterations(v),
			),
			bindAtom(this.store, this.poolSize, (v) => {
				this.orchestrator.setPoolSize(v);
			}),
			bindAtom(this.store, this.orchestratorName, (v) => {
				this.orchestrator.dispose();
				this.orchestrator = this.getOrchestrator(v);
			}),
		];
	}

	public dispose() {
		this.events.deattach();
		this.orchestrator.dispose();
		this.unsubs.forEach((unsub) => unsub());
		cancelAnimationFrame(this.rafNumber);
	}

	private tick = () => {
		this.orchestrator.update();
		this.rafNumber = requestAnimationFrame(this.tick);
	};

	private getOrchestrator(name?: OrchestratorName) {
		const orchName = name || this.store.get(this.orchestratorName);

		return orchestrators[orchName](this.canvas, this.camera, {
			poolSize: this.store.get(this.poolSize),
			tileSize: this.store.get(this.tileSize),
			maxIters: this.store.get(this.maxIters),
		});
	}
}
