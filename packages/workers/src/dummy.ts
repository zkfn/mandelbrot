import type { TileAssignment, TileResult } from "@mandelbrot/common";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const minMs = 20;
const maxMs = 100;

self.onmessage = async (e: MessageEvent<TileAssignment>) => {
	const { tileId, tile } = e.data;
	await sleep(Math.floor(minMs + Math.random() * (maxMs - minMs)));

	const out: TileResult<null> = {
		tileId,
		payload: null,
		tile,
	};

	(self as DedicatedWorkerGlobalScope).postMessage(out);
};
