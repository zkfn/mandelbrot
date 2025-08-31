import { type WithTID } from "@lib/jobs";

export interface Supervisor<
	SendMessage,
	ReceiveMessage,
	Assignment extends WithTID,
	Result extends WithTID,
> {
	hireWorker(): Worker;
	assignWorker(job: Assignment): SendMessage;
	collectResult(message: ReceiveMessage): Promise<Result>;
}
