export interface WorkerInterface<TPost, TRecv> {
  postMessage(message: TPost, transfer?: Transferable[]): void;
  onmessage: ((this: WorkerInterface<TPost, TRecv>, ev: MessageEvent<TRecv>) => void) | null;
  terminate: () => void;
}

export type WorkerWithProtocol<TData, TResult> = WorkerInterface<
  QueueToWorkerMessage<TData>,
  WorkerToQueueMessage<TResult>
>;

export type JobPayload<TData> = { jobId: string; data: TData };
export type JobPayloadWithGeneration<TData> = JobPayload<TData> & { generation: number };

export type ResultMessage<TResult> = {
  kind: "result";
  remainingJobs: number;
  generation: number;
  jobId: string;
  data: TResult;
};

export type CancelledMessage = { kind: "cancelled"; jobIds: string[]; remainingJobs: number };

export type WorkerToQueueMessage<TResult> = ResultMessage<TResult> | CancelledMessage;

export type QueueToWorkerMessage<TData> =
  | { kind: "assign"; generation: number; jobs: JobPayload<TData>[] }
  | { kind: "cancel"; jobIds: string[] }
  | { kind: "cancel-all" };
