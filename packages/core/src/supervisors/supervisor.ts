import type { TileAssignment, WithTileId } from "@mandelbrot/common";

export type SupervisorsReceiveMessage<
	S extends Supervisor<unknown, WithTileId>,
> = S extends Supervisor<infer RM, WithTileId> ? RM : never;

export type SupervisorsResult<S extends Supervisor<unknown, WithTileId>> =
	S extends Supervisor<unknown, infer RES> ? RES : never;

export interface Supervisor<ReceiveMessage, Result extends WithTileId> {
	hireWorker(): Worker;
	assignWorker(worker: Worker, job: TileAssignment): void;
	collectResult(message: ReceiveMessage): Promise<Result>;
}
