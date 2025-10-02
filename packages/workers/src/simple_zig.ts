import type { TileAssignment, TileResult } from "@mandelbrot/common";
import { loadWasm, type WasmExports } from "@mandelbrot/zig";
import workerUrl from "@mandelbrot/zig/wasm/simple_worker.wasm?url";

let wasm: WasmExports;
let ptr = 0;
let allocated = 0;
let buffer = new Uint8ClampedArray();

const reallocIfNeeded = (size: number): number => {
	if (size !== allocated) {
		ptr = wasm.alloc(size);
		buffer = new Uint8ClampedArray(wasm.memory.buffer, ptr, size);
		allocated = size;
	}

	return ptr;
};

const getWasm = async () => {
	if (wasm === undefined) {
		wasm = await loadWasm(workerUrl);
	}

	return wasm;
};

self.onmessage = async (message: MessageEvent<TileAssignment>) => {
	const wasm = await getWasm();
	const data = message.data;

	const width = Math.max(1, data.tile.resolution.width || 0);
	const height = Math.max(1, data.tile.resolution.height || 0);

	const maxIter = data.maxIter ?? 500;
	const size = width * height * 4;

	const { minX, maxX, minY, maxY } = data.tile.section;

	reallocIfNeeded(size);
	wasm.render(minX, maxX, minY, maxY, width, height, maxIter, ptr);

	const out: TileResult<ArrayBuffer> = {
		tileId: data.tileId,
		tile: data.tile,
		payload: buffer,
	};

	postMessage(out);
};
