import type { WorkerInMessage, WorkerOutMessage } from "@common/protocol";
import type { Bounds } from "@common/types";

function renderMandelbrot(
	section: Bounds,
	width: number,
	height: number,
	maxIter: number,
): Uint8ClampedArray {
	const out = new Uint8ClampedArray(width * height * 4);
	const dx = (section.maxX - section.minX) / width;
	const dy = (section.maxY - section.minY) / height;

	let idx = 0;
	for (let j = 0; j < height; j++) {
		const cy = section.minY + (j + 0.5) * dy;
		for (let i = 0; i < width; i++) {
			const cx = section.minX + (i + 0.5) * dx;

			let x = 0,
				y = 0,
				it = 0;
			while (it < maxIter && x * x + y * y <= 4) {
				const xx = x * x - y * y + cx;
				y = 2 * x * y + cy;
				x = xx;
				it++;
			}

			const v = it >= maxIter ? 0 : Math.floor((255 * it) / maxIter);
			out[idx++] = v;
			out[idx++] = v;
			out[idx++] = v;
			out[idx++] = 255;
		}
	}
	return out;
}

self.onmessage = (message: MessageEvent<WorkerInMessage>) => {
	const data = message.data;

	const width = Math.max(1, data.tile.rect.width || 0);
	const height = Math.max(1, data.tile.rect.height || 0);
	const maxIter = data.maxIter ?? 500;

	const pixels = renderMandelbrot(data.tile.section, width, height, maxIter);
	const out: WorkerOutMessage<ArrayBuffer> = {
		jobId: data.jobId,
		tile: data.tile,
		payload: pixels.buffer,
	};

	postMessage(out, [pixels.buffer]);
};
