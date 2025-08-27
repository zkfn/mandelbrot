type DummyInMessage = {
	jobId: number;
	tileId: string;
	simulateMs?: number;
};

type DummyOutMessage = {
	jobId: number;
	tileId: string;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

self.onmessage = async (e: MessageEvent<DummyInMessage>) => {
	const { jobId, tileId, simulateMs = 200 } = e.data;
	await sleep(simulateMs);
	const out: DummyOutMessage = { jobId, tileId };
	(self as DedicatedWorkerGlobalScope).postMessage(out);
};
