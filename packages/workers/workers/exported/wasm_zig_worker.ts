import type { TileAssignment, TileResult } from "@mandelbrot/common";
import type { WasmExports } from "@mandelbrot/zig";
import workerUrl from "@mandelbrot/zig/wasm/simple_worker.wasm?url";
import { loadWasm, workerMainFunc } from "../common";

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

workerMainFunc(async (assignment: TileAssignment) => {
	const wasm = await getWasm();

	const width = Math.max(1, assignment.tile.resolution.width || 0);
	const height = Math.max(1, assignment.tile.resolution.height || 0);

	const maxIter = assignment.maxIter;
	const size = width * height * 4;

	const { minX, maxX, minY, maxY } = assignment.tile.section;

	reallocIfNeeded(size);
	wasm.render(minX, maxX, minY, maxY, width, height, maxIter, ptr);

	const result: TileResult<ArrayBuffer> = {
		tileId: assignment.tileId,
		tile: assignment.tile,
		payload: buffer,
	};

	return {
		result,
	};
});
