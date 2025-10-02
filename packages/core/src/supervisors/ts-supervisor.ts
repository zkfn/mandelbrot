import type { TileAssignment, TileResult } from "@mandelbrot/common";
import TSWorker from "@mandelbrot/workers/mandelbrot.ts?worker";
import type { Supervisor } from "./supervisor";

export class TSSupervisor
	implements Supervisor<TileResult<ArrayBuffer>, TileResult<ImageBitmap>>
{
	public hireWorker(): Worker {
		return new TSWorker();
	}

	public assignWorker(worker: Worker, assignment: TileAssignment): void {
		worker.postMessage(assignment);
	}

	public async collectResult(
		message: TileResult<ArrayBuffer>,
	): Promise<TileResult<ImageBitmap>> {
		const rgba = new Uint8ClampedArray(message.payload);
		const img = new ImageData(
			rgba,
			message.tile.resolution.width,
			message.tile.resolution.height,
		);

		const bitmap = await createImageBitmap(img);

		return {
			tileId: message.tileId,
			tile: message.tile,
			payload: bitmap,
		};
	}
}
