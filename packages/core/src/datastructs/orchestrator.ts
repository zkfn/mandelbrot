import {
	ReadAndClearFlag,
	type TileAssignment,
	type TileResult,
	type Unsubscribe,
} from "@mandelbrot/common";
import { assertGtZero } from "@mandelbrot/common/asserts";
import {
	determineDefaultPoolSize,
	type SubscribableSupervisor,
	WorkerPool,
} from "@mandelbrot/workers";
import type { Camera } from "../camera";
import type { Painter } from "../painters";
import Cache from "./cache";
import ImageComposer from "./composer";

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

	private dirtyFlag: ReadAndClearFlag;

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
		this.composer = new ImageComposer(
			tileSize,
			this.camera,
			this.cache,
			this.painter,
		);

		this.camera.addInvalidator(this.dirtyFlag.set);
		this.unsubs = [];

		this.attachSupervisorListeners();
	}

	public update() {
		if (!this.dirtyFlag.readAndClear()) return;

		const misses = this.composer.compose();

		if (misses !== null) {
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
		}
	}

	public dispose(): void {
		this.unsubAll();
		this.cache.clear();
		this.pool.dispose();
		this.composer.invalidateRememberedView();
	}

	public getTileSize(): number {
		return this.composer.getTileSize();
	}

	public setTileSize(tileSize: number) {
		if (tileSize != this.getTileSize()) {
			this.composer.setTileSize(tileSize);
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
		this.composer.invalidateRememberedView();
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
