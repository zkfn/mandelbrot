import type { WithTileId } from "@common/tiles";

export type SupervisorsSendMessage<
	S extends Supervisor<any, any, WithTileId, WithTileId>,
> = S extends Supervisor<infer SM, any, any, any> ? SM : never;

export type SupervisorsReceiveMessage<
	S extends Supervisor<any, any, WithTileId, WithTileId>,
> = S extends Supervisor<any, infer RM, any, any> ? RM : never;

export type SupervisorsAssignment<
	S extends Supervisor<any, any, WithTileId, WithTileId>,
> = S extends Supervisor<any, any, infer ASSIG, any> ? ASSIG : never;

export type SupervisorsResult<
	S extends Supervisor<any, any, WithTileId, WithTileId>,
> = S extends Supervisor<any, any, any, infer RES> ? RES : never;

export interface Supervisor<
	SendMessage,
	ReceiveMessage,
	Assignment extends WithTileId,
	Result extends WithTileId,
> {
	hireWorker(): Worker;
	assignWorker(job: Assignment): SendMessage;
	collectResult(message: ReceiveMessage): Promise<Result>;
}
