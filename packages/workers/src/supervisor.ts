import {
	type Subject,
	SubjectImpl,
	type TileAssignment,
	type TileResult,
} from "@mandelbrot/common";

export type Job<Payload> = {
	payload: Payload;
	transfer?: Transferable[];
};

export interface Supervisor<JobAssignment = unknown, Result = unknown> {
	hireWorker: () => Worker;
	assignJob: (job: JobAssignment) => Job<unknown>;
	jobFailed: (job: JobAssignment) => void;
	collectResult: (result: Result) => unknown;
}

export interface SubscribableSupervisor<
	JobAssignment = unknown,
	Immediate = unknown,
	Result = unknown,
> extends Supervisor<JobAssignment, Immediate>,
		Subject<{
			jobStart: [JobAssignment];
			jobRedo: [JobAssignment];
			jobDone: [Result];
		}> {}

export class BitmapSupervisor
	extends SubjectImpl<{
		jobStart: [TileAssignment];
		jobRedo: [TileAssignment];
		jobDone: [TileResult<ImageBitmap>];
	}>
	implements
		SubscribableSupervisor<
			TileAssignment,
			TileResult<ArrayBufferLike>,
			TileResult<ImageBitmap>
		>
{
	private workerConstructor: new () => Worker;

	public constructor(workerConstructor: new () => Worker) {
		super();
		this.workerConstructor = workerConstructor;
	}

	public hireWorker(): Worker {
		return new this.workerConstructor();
	}

	public assignJob(job: TileAssignment): Job<unknown> {
		this.notify("jobStart", job);
		return { payload: job };
	}

	public jobFailed(job: TileAssignment): void {
		this.notify("jobRedo", job);
	}

	public collectResult(result: TileResult<ArrayBufferLike>): void {
		this.handleBitmap(result);
	}

	private async handleBitmap(result: TileResult<ArrayBufferLike>) {
		this.notify("jobDone", {
			tile: result.tile,
			tileId: result.tileId,
			payload: await createImageBitmap(
				new ImageData(
					new Uint8ClampedArray(result.payload),
					result.tile.resolution.width,
					result.tile.resolution.height,
				),
			),
		});
	}
}
