// import { TileStore } from "@lib/store";
// import { TileJobQueue } from "@lib/queue";
// import DummyWorker from "@workers/dummy.ts?worker";
// import type { ReadAndClearFlag } from "@common/flag";
// import type { WorkerInMessage, WorkerOutMessage } from "@common/protocol";
// import type { Tile } from "@common/tiles";
//
// export class WorkerExecutor<Payload = null> {
// 	private disposed = false;
// 	private tileQueue: Tile[];
//
// 	private jobSeq = 1;
// 	private readonly inflight = new Map<number, { tile: Tile; worker: Worker }>();
//
// 	private readonly workers: Worker[] = [];
// 	private readonly idle: Worker[] = [];
//
// 	private readonly poolSize: number;
// 	private readonly store: TileStore<Payload>;
// 	private readonly dirtyFlag: ReadAndClearFlag;
//
// 	constructor(
// 		store: TileStore<Payload>,
// 		dirtyFlag: ReadAndClearFlag,
// 		poolSize: number = 8,
// 	) {
// 		this.poolSize = poolSize;
// 		this.dirtyFlag = dirtyFlag;
// 		this.store = store;
// 		this.tileQueue = [];
//
// 		for (let i = 0; i < this.poolSize; i++) {
// 			const w = new DummyWorker();
// 			w.onmessage = (e: MessageEvent<WorkerOutMessage<null>>) => {
// 				this.handleDone(w, e.data);
// 			};
// 			w.onerror = (e) => this.handleError(w, e);
// 			this.workers.push(w);
// 			this.idle.push(w);
// 		}
// 	}
//
// 	/** Fill idle workers with jobs. Call after enqueue or when a job finishes. */
// 	public pump(): void {
// 		if (this.disposed) return;
//
// 		while (this.idle.length > 0) {
// 			const tile = this.queue.dequeue(); // your queue returns a Tile (coarse-first)
// 			if (!tile) break;
//
// 			const worker = this.idle.pop()!;
// 			const jobId = this.jobSeq++;
//
// 			this.store.setRendering(tile.key.id()); // yellow now
// 			this.dirtyFlag.set();
//
// 			this.inflight.set(jobId, { tile, worker });
//
// 			const msg: WorkerInMessage = { jobId, tile, tileId: tile.key.id() };
// 			worker.postMessage(msg);
// 		}
// 	}
//
// 	public dispose(): void {
// 		this.disposed = true;
// 		this.inflight.clear();
// 		for (const w of this.workers)
// 			try {
// 				w.terminate();
// 			} catch {}
// 		this.idle.length = 0;
// 		this.workers.length = 0;
// 	}
//
// 	private handleDone(worker: Worker, msg: WorkerOutMessage<null>): void {
// 		if (this.disposed) return;
//
// 		const rec = this.inflight.get(msg.jobId);
// 		if (rec) {
// 			this.inflight.delete(msg.jobId);
//
// 			this.store.setReady(
// 				msg.tileId as string,
// 				undefined as unknown as Payload,
// 			);
//
// 			this.dirtyFlag.set();
// 		}
//
// 		this.idle.push(worker);
// 		this.pump();
// 	}
//
// 	private handleError(worker: Worker, _: unknown): void {
// 		for (const [jobId, rec] of this.inflight) {
// 			if (rec.worker === worker) this.inflight.delete(jobId);
// 		}
//
// 		try {
// 			worker.terminate();
// 		} catch {}
// 		const replacement = new DummyWorker();
// 		replacement.onmessage = (e: MessageEvent<WorkerOutMessage<null>>) =>
// 			this.handleDone(replacement, e.data);
// 		replacement.onerror = (e) => this.handleError(replacement, e);
// 		this.workers.push(replacement);
// 		this.idle.push(replacement);
// 		this.pump();
// 	}
// }
