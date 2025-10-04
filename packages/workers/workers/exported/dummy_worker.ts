import type { TileAssignment } from "@mandelbrot/common";
import { workerMainFunc } from "../common";

const minMs = 20;
const maxMs = 100;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

workerMainFunc(async (assignment: TileAssignment) => {
	await sleep(Math.floor(minMs + Math.random() * (maxMs - minMs)));

	return {
		result: {
			tile: assignment.tile,
			tileId: assignment.tileId,
			payload: null,
		},
	};
});
