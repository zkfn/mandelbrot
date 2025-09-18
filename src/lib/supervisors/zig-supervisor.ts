import type { TileResult } from "@common/protocol";
import type { TileAssignment } from "@common/tiles";
import type { Supervisor } from "@lib/supervisors/supervisor";
import WasmWorker from "@workers/simple_zig?worker";

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
