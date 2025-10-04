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
