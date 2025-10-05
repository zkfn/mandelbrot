import {
	ReadAndClearFlag,
	type TileAssignment,
	type TileResult,
	Tiler,
	type Unsubscribe,
	ViewCornerTiles,
} from "@mandelbrot/common";
import { assertGtZero } from "@mandelbrot/common/asserts";
import {
	determineDefaultPoolSize,
	type SubscribableSupervisor,
	WorkerPool,
} from "@mandelbrot/workers";
import Cache from "./cache";
import type Camera from "./camera";
import ImageComposer from "./composer";
import type Painter from "./painter";

export interface OrchestratorContext<Result> {
	composer: ImageComposer<Result>;
	cache: Cache<TileResult<Result>>;
	dirtyFlag: ReadAndClearFlag;
}

type JobAssignCallback<Result> = (
	assignment: TileAssignment,
	ctx: OrchestratorContext<Result>,
) => void;

type JobRedoCallback<Result> = (
	assignment: TileAssignment,
	ctx: OrchestratorContext<Result>,
) => void;

type JobDoneCallback<Result> = (
	result: TileResult<Result>,
	ctx: OrchestratorContext<Result>,
) => void;

interface OrchestratorCallbacks<Result> {
	jobDone?: JobDoneCallback<Result>;
	jobAssign?: JobAssignCallback<Result>;
	jobRedo?: JobRedoCallback<Result>;
}

export interface OrchestratorProps {
	maxIters: number;
	tileSize: number;
	poolSize: number;
}

const defaultProps: OrchestratorProps = {
	maxIters: 500,
	tileSize: 128,
	poolSize: determineDefaultPoolSize(),
};

export default class Orchestrator<Result, Immediate = unknown> {
	private maxIters: number;
	private camera: Camera;

	private composer: ImageComposer<Result>;
	private cache: Cache<TileResult<Result>>;
	private pool: WorkerPool<TileAssignment, TileResult<Immediate>>;
	private painter: Painter<Result>;
	private tiler: Tiler;

	private dirtyFlag: ReadAndClearFlag;
	private previousView: ViewCornerTiles | null;

	private supervisor: SubscribableSupervisor<
		TileAssignment,
		TileResult<Immediate>,
		TileResult<Result>
	>;

	private jobDone?: JobDoneCallback<Result>;
	private jobAssign?: JobAssignCallback<Result>;
	private jobRedo?: JobRedoCallback<Result>;

	private unsubs: Unsubscribe[];

	public constructor(
		supervisor: SubscribableSupervisor<
			TileAssignment,
			TileResult<Immediate>,
			TileResult<Result>
		>,
		painter: Painter<Result>,
		camera: Camera,
		props: Partial<OrchestratorProps> = {},
		callbacks: OrchestratorCallbacks<Result> = {},
	) {
		const {
			poolSize = defaultProps.poolSize,
			maxIters = defaultProps.maxIters,
			tileSize = defaultProps.maxIters,
		} = props;

		const { jobDone, jobRedo, jobAssign } = callbacks;

		this.previousView = null;

		this.maxIters = maxIters;
		this.camera = camera;
		this.painter = painter;
		this.supervisor = supervisor;

		this.jobAssign = jobAssign;
		this.jobRedo = jobRedo;
		this.jobDone = jobDone;

		this.dirtyFlag = new ReadAndClearFlag(true);
		this.cache = new Cache();
		this.pool = new WorkerPool(supervisor, poolSize);
		this.tiler = new Tiler(camera.planeSide, tileSize);

		this.composer = new ImageComposer(
			this.camera,
			this.cache,
			this.painter,
			this.tiler,
		);

		this.camera.addInvalidator(this.dirtyFlag.set);
		this.unsubs = [];

		this.attachSupervisorListeners();
	}

	public update() {
		if (!this.dirtyFlag.readAndClear()) return;

		const misses = this.composer.compose();

		if (this.didViewChange()) {
			this.pool.clearQueue();

			const rendering = new Set(
				this.pool.getRunningJobs().map((job) => job.tileId),
			);

			const assignments: TileAssignment[] = misses
				.filter((tile) => !rendering.has(tile.tileId))
				.map((tile) => ({
					tileId: tile.tileId,
					tile,
					maxIter: this.maxIters,
				}));

			this.pool.enqueueEnd(...assignments);
			this.cache.tick();
		}
	}

	public dispose(): void {
		this.unsubAll();
		this.cache.clear();
		this.pool.dispose();
	}

	public getCacheUse(): number {
		return this.cache.getCacheUse();
	}

	public getCacheCapacity(): number {
		return this.cache.getCapacity();
	}

	public getTileSize(): number {
		return this.tiler.getTileSize();
	}

	public setTileSize(tileSize: number) {
		if (tileSize != this.getTileSize()) {
			this.tiler.setTileSize(tileSize);
			this.flush();
		}
	}

	public getMaxIterations(): number {
		return this.maxIters;
	}

	public setMaxIterations(maxIters: number): void {
		assertGtZero(maxIters);

		if (this.maxIters !== maxIters) {
			this.maxIters = maxIters;
			this.flush();
		}
	}

	public getPoolSize(): number {
		return this.pool.getPoolSize();
	}

	public setPoolSize(size: number): void {
		this.pool.setPoolSize(size);
	}

	public getWorkerBusyness(): boolean[] {
		return this.pool.getWorkerBusyness();
	}

	public getQueueSize(): number {
		return this.pool.getQueueSize();
	}

	private flush() {
		this.previousView = null;
		this.cache.clear();
		this.pool.clearQueueAndInvalidateRunningJobs();
		this.dirtyFlag.set();
	}

	private unsubAll() {
		this.unsubs.forEach((unsub) => unsub());
	}

	private attachSupervisorListeners() {
		if (this.jobDone !== undefined) {
			this.unsubs.push(
				this.supervisor.subscribe("jobDone", this.appendContext(this.jobDone)),
			);
		}

		if (this.jobRedo !== undefined) {
			this.unsubs.push(
				this.supervisor.subscribe("jobRedo", this.appendContext(this.jobRedo)),
			);
		}

		if (this.jobAssign !== undefined) {
			this.unsubs.push(
				this.supervisor.subscribe(
					"jobStart",
					this.appendContext(this.jobAssign),
				),
			);
		}
	}

	private didViewChange(): boolean {
		const corners = this.tiler.cornerTiles(
			this.camera.viewportBounds(),
			this.camera.getDepthPerResolution(this.tiler.getTileSize()),
		);

		if (!this.previousView || !this.previousView.isSameAs(corners)) {
			this.previousView = corners;
			return true;
		} else {
			return false;
		}
	}

	private appendContext = <Argument>(
		fn: (arg: Argument, ctx: OrchestratorContext<Result>) => void,
	) => {
		return (arg: Argument) =>
			fn(arg, {
				dirtyFlag: this.dirtyFlag,
				composer: this.composer,
				cache: this.cache,
			});
	};
}
