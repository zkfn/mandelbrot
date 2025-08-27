import type { WorkerOutMessage, WorkerInMessage } from "@common/protocol";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const minMs = 20;
const maxMs = 100;

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
	const { jobId, tileId } = e.data;
	await sleep(Math.floor(minMs + Math.random() * (maxMs - minMs)));

	const out: WorkerOutMessage<null> = {
		jobId,
		tileId,
		payload: null,
	};

	(self as DedicatedWorkerGlobalScope).postMessage(out);
};
