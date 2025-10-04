import type {
	Invalidable,
	Invalidator,
	TileAssignment,
	TileResult,
} from "@mandelbrot/common";
import { InvalidatorPool } from "@mandelbrot/common";
import {
	bitmapSupervisor,
	type Supervisor,
	WorkerPool,
} from "@mandelbrot/workers";
// import TSWorker from "@mandelbrot/workers/workers/ts_worker.ts?worker";
import WASMWorker from "@mandelbrot/workers/workers/wasm_zig_worker.ts?worker";
import { TileStore } from "./store";

export class JobQueue implements Invalidable {
	private readonly invalidatorPool: InvalidatorPool;
	private readonly store: TileStore<TileResult<ImageBitmap>>;
	private readonly supervisor: Supervisor<
		TileAssignment,
		TileAssignment,
		TileResult<ArrayBufferLike>
	>;

	private workerPool: WorkerPool<
		TileAssignment,
		TileAssignment,
		TileResult<ArrayBufferLike>
	>;

	public constructor(
		poolSize: number,
		store: TileStore<TileResult<ImageBitmap>>,
	) {
		this.store = store;
		this.supervisor = bitmapSupervisor(
			WASMWorker,
			this.beforeRender,
			this.onBitmapReady,
		);
		this.invalidatorPool = new InvalidatorPool();
		this.workerPool = new WorkerPool(this.supervisor, poolSize);
	}

	private beforeRender = (assignmet: TileAssignment) => {
		this.store.setRendering(assignmet.tileId);
	};

	private onBitmapReady = (bitmapResult: TileResult<ImageBitmap>) => {
		this.store.setReady(bitmapResult.tileId, bitmapResult);
		this.invalidatorPool.invalidate();
	};

	public setPoolSize(poolSize: number): void {
		this.workerPool.setPoolSize(poolSize);
	}

	public getPoolSize(): number {
		return this.workerPool.getPoolSize();
	}

	public addInvalidator(inv: Invalidator): void {
		this.invalidatorPool.addInvalidator(inv);
	}

	public removeInvalidator(inv: Invalidator): void {
		this.invalidatorPool.removeInvalidator(inv);
	}

	public getWorkerBusyness(): boolean[] {
		return this.workerPool.getWorkerBusyness();
	}

	public getRenderTimePerTile(): number {
		return 0;
	}

	public getQueueSize(): number {
		return this.workerPool.getQueueSize();
	}

	public enqueueEnd(...assignments: TileAssignment[]): void {
		this.workerPool.enqueueEnd(...assignments);
	}

	public enqueueStart(...assignments: TileAssignment[]): void {
		this.workerPool.enqueueStart(...assignments);
	}

	public prune(): void {
		this.workerPool.clearQueue();
	}

	public clear(): void {
		this.workerPool.clearQueueAndInvalidateRunningJobs();
	}

	public dispose(): void {
		this.workerPool.dispose();
	}
}
