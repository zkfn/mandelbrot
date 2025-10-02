type RenderFn = (
	min_x: number,
	max_x: number,
	min_y: number,
	max_y: number,
	w: number,
	h: number,
	max_iter: number,
	buffer: number,
) => void;

export interface WasmExports {
	memory: WebAssembly.Memory;
	render: RenderFn;
	alloc: (len: number) => number;
}

export async function loadWasm(url: string): Promise<WasmExports> {
	const res = await fetch(url);
	const { instance } = await WebAssembly.instantiateStreaming(res, {});
	return instance.exports as unknown as WasmExports;
}
