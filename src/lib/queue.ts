import type { Tile } from "./tiles";

export class TileJobQueue {
	private jobs: Tile[] = [];

	public nextGeneration(): void {
		this.jobs = [];
	}

	public push(...tiles: Tile[]): void {
		this.jobs.push(...tiles);
	}

	public dequeue(): Tile | undefined {
		return this.jobs.shift();
	}
}
