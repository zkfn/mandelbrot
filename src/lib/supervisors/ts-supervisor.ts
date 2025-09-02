import type { TileAssignment, TileResult } from "@common/protocol";
import type { Supervisor } from "@lib/supervisors/supervisor";
import TSWorker from "@workers/mandelbrot?worker";

export class TSSupervisor
	implements
		Supervisor<TileResult<ArrayBuffer>, TileAssignment, TileResult<ImageBitmap>>
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
