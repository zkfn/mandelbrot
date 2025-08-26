import { TileStore } from "@lib/store";
import { TileJobQueue } from "@lib/queue";
import type { ReadAndClearFlag } from "@common/flag";
import type { Tile } from "./tiles";

export function makeSleepRunner<Payload = unknown>(
	minMs = 120,
	maxMs = 540,
): JobRunner<Payload> {
	return async () => {
		const delay = Math.floor(minMs + Math.random() * (maxMs - minMs));
		await new Promise<void>((r) => setTimeout(r, delay));
		return undefined as unknown as Payload;
	};
}

export type JobRunner<Payload = unknown> = (job: Tile) => Promise<Payload>;

export interface ExecutorOptions {
	maxConcurrent?: number; // default 4
	minSimulatedMs?: number; // default 120 (only used by default runner)
	maxSimulatedMs?: number; // default 540 (only used by default runner)
}

export class WorkerExecutor<Payload = unknown> {
	private runningCount = 0;
	private disposed = false;
	private readonly maxConcurrent: number;
	private readonly runJob: JobRunner<Payload>;

	constructor(
		private readonly store: TileStore<Payload>,
		private readonly queue: TileJobQueue,
		private readonly dirtyFlag: ReadAndClearFlag,
		options: ExecutorOptions = {},
	) {
		this.maxConcurrent = options.maxConcurrent ?? 4;
		const minMs = options.minSimulatedMs ?? 20;
		const maxMs = options.maxSimulatedMs ?? 50;
		this.runJob = makeSleepRunner<Payload>(minMs, maxMs);
	}

	public pump(): void {
		if (this.disposed) return;

		while (this.runningCount < this.maxConcurrent) {
			const tile = this.queue.dequeue();
			if (!tile) break;

			this.store.setRendering(tile.key.id());
			this.runningCount += 1;
			this.startJob(tile);
		}
	}

	private async startJob(tile: Tile): Promise<void> {
		try {
			const payload = await this.runJob(tile);

			this.store.setReady(tile.key.id(), payload);
			this.dirtyFlag.set();
		} finally {
			this.runningCount = Math.max(0, this.runningCount - 1);
			this.pump();
		}
	}
}
