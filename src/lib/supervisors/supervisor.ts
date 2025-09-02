import type { WithTileId } from "@common/tiles";

export type SupervisorsReceiveMessage<
	S extends Supervisor<any, WithTileId, WithTileId>,
> = S extends Supervisor<infer RM, any, any> ? RM : never;

export type SupervisorsAssignment<
	S extends Supervisor<any, WithTileId, WithTileId>,
> = S extends Supervisor<any, infer ASSIG, any> ? ASSIG : never;

export type SupervisorsResult<
	S extends Supervisor<any, WithTileId, WithTileId>,
> = S extends Supervisor<any, any, infer RES> ? RES : never;

export interface Supervisor<
	ReceiveMessage,
	Assignment extends WithTileId,
	Result extends WithTileId,
> {
	hireWorker(): Worker;
	assignWorker(worker: Worker, job: Assignment): void;
	collectResult(message: ReceiveMessage): Promise<Result>;
}
