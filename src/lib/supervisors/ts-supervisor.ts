import type { WorkerInMessage, WorkerOutMessage } from "@common/protocol";
import type { Tile, WithTileId } from "@common/tiles";
import type { Supervisor } from "@lib/supervisors/supervisor";
import TSWorker from "@workers/mandelbrot?worker";

export interface BitmapTileResult extends WithTileId {
	bitmap: ImageBitmap;
}

export interface TSJobAssignment extends WithTileId {
	tile: Tile;
}

export class TSSupervisor
	implements
		Supervisor<
			WorkerInMessage,
			WorkerOutMessage<ArrayBuffer>,
			TSJobAssignment,
			BitmapTileResult
		>
{
	public hireWorker(): Worker {
		return new TSWorker();
	}

	public assignWorker(job: TSJobAssignment): WorkerInMessage {
		return { tile: job.tile, tileId: job.tileId };
	}

	public async collectResult(
		message: WorkerOutMessage<ArrayBuffer>,
	): Promise<BitmapTileResult> {
		const rgba = new Uint8ClampedArray(message.payload);
		const img = new ImageData(
			rgba,
			message.tile.resolution.width,
			message.tile.resolution.height,
		);
		const bitmap = await createImageBitmap(img);
		return {
			tileId: message.tileId,
			bitmap,
		};
	}
}
