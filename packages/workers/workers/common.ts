export const loadWasm = async <Exports>(url: string): Promise<Exports> => {
	const res = await fetch(url);
	const { instance } = await WebAssembly.instantiateStreaming(res, {});
	return instance.exports as unknown as Exports;
};

export type WorkerResult<Result> = {
	result: Result;
	transfer?: Transferable[];
};

type SyncMainFunction<Assignment, Result> = (
	assignment: Assignment,
) => WorkerResult<Result>;

type AsyncMainFunction<Assignment, Result> = (
	assignment: Assignment,
) => Promise<WorkerResult<Result>>;

type MainFunction<Assignment, Result> =
	| AsyncMainFunction<Assignment, Result>
	| SyncMainFunction<Assignment, Result>;

export function workerMainFunc<A, R>(fn: MainFunction<A, R>) {
	self.onmessage = async (event: MessageEvent<A>) => {
		const { result, transfer } = await fn(event.data);
		if (transfer) {
			(self as DedicatedWorkerGlobalScope).postMessage(result, transfer);
		} else {
			(self as DedicatedWorkerGlobalScope).postMessage(result);
		}
	};
}
