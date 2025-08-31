import type { WorkerInMessage, WorkerOutMessage } from "@common/protocol";
import { tileId, type Tile } from "@common/tiles";
import type { WithTID } from "@lib/jobs";
import type { Supervisor } from "@lib/supervisor";
import TSWorker from "@workers/mandelbrot?worker";

export interface BitmapTileResult extends WithTID {
	bitmap: ImageBitmap;
}

export interface TSJobAssignment extends WithTID {
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
		return { tile: job.tile };
	}

	public async collectResult(
		message: WorkerOutMessage<ArrayBuffer>,
	): Promise<BitmapTileResult> {
		const rgba = new Uint8ClampedArray(message.payload);
		const img = new ImageData(
			rgba,
			message.tile.rect.width,
			message.tile.rect.height,
		);
		const bitmap = await createImageBitmap(img);
		return {
			tileId: tileId(message.tile),
			bitmap,
		};
	}
}
