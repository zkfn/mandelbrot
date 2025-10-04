import type { TileAssignment, TileResult } from "@mandelbrot/common";

export type Job<Payload> = {
	payload: Payload;
	transfer?: Transferable[];
};

export interface Supervisor<
	JobAssignment = unknown,
	TransferedPayload = unknown,
	Result = unknown,
> {
	hireWorker: () => Worker;
	assignJob: (job: JobAssignment) => Job<TransferedPayload>;
	collectResult: (result: Result) => unknown;
}

export function bitmapSupervisor(
	constructor: new () => Worker,
	beforeRender: (assignment: TileAssignment) => unknown,
	afterResult: (bitmap: TileResult<ImageBitmap>) => unknown,
): Supervisor<TileAssignment, TileAssignment, TileResult<ArrayBufferLike>> {
	return {
		hireWorker: () => new constructor(),
		assignJob: (job: TileAssignment) => {
			beforeRender(job);
			return { payload: job };
		},
		collectResult: async (result) => {
			const rgba = new Uint8ClampedArray(result.payload);
			const img = new ImageData(
				rgba,
				result.tile.resolution.width,
				result.tile.resolution.height,
			);

			const bitmap = await createImageBitmap(img);

			afterResult({
				tile: result.tile,
				tileId: result.tileId,
				payload: bitmap,
			});
		},
	};
}
