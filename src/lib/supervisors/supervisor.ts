import type { TileAssignment, WithTileId } from "@common/tiles";

export type SupervisorsReceiveMessage<S extends Supervisor<any, WithTileId>> =
	S extends Supervisor<infer RM, any> ? RM : never;

// export type SupervisorsAssignment<
// 	S extends Supervisor<any, WithTileId, WithTileId>,
// > = S extends Supervisor<any, infer ASSIG, any> ? ASSIG : never;

export type SupervisorsResult<S extends Supervisor<any, WithTileId>> =
	S extends Supervisor<any, infer RES> ? RES : never;

export interface Supervisor<ReceiveMessage, Result extends WithTileId> {
	hireWorker(): Worker;
	assignWorker(worker: Worker, job: TileAssignment): void;
	collectResult(message: ReceiveMessage): Promise<Result>;
}
