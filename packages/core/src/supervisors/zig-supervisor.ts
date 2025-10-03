import type { TileAssignment, TileResult } from "@mandelbrot/common";
import WasmWorker from "@mandelbrot/workers/simple_zig.ts?worker";
import type { Supervisor } from "../supervisors/supervisor";

export class ZigSupervisor
	implements Supervisor<TileResult<Uint8ClampedArray>, TileResult<ImageBitmap>>
{
	public hireWorker(): Worker {
		return new WasmWorker();
	}

	public assignWorker(worker: Worker, assignment: TileAssignment): void {
		worker.postMessage(assignment);
	}

	public async collectResult(
		message: TileResult<Uint8ClampedArray>,
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
