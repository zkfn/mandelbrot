/** Map event names to arguments for Handlers */
type EventMap = Record<string, unknown[]>;
type Handler<Args extends unknown[]> = (...args: Args) => void;

export type Unsubscribe = () => void;

export interface Subject<Events extends EventMap> {
	subscribe<K extends keyof Events>(
		event: K,
		handler: Handler<Events[K]>,
	): Unsubscribe;

	unsubscribe<K extends keyof Events>(
		event: K,
		handler: Handler<Events[K]>,
	): void;
}

export class SubjectImpl<Events extends EventMap> implements Subject<Events> {
	private listeners: Partial<{
		[K in keyof Events]: Set<Handler<Events[K]>>;
	}>;

	public constructor() {
		this.listeners = {};
	}

	public subscribe<K extends keyof Events>(
		event: K,
		handler: Handler<Events[K]>,
	): Unsubscribe {
		let set = this.listeners[event];

		if (set === undefined) {
			set = new Set();
			this.listeners[event] = set;
		}

		set.add(handler);
		return () => this.unsubscribe(event, handler);
	}

	public unsubscribe<K extends keyof Events>(
		event: K,
		handler: Handler<Events[K]>,
	): void {
		this.listeners[event]?.delete(handler);
	}

	protected notify<K extends keyof Events>(event: K, ...args: Events[K]): void {
		const set = this.listeners[event];
		if (!set || set.size === 0) return;

		[...set].forEach((handler) => handler(...args));
	}

	protected clear(event?: keyof Events): void {
		if (event) {
			this.listeners[event]?.clear();
		} else {
			for (const event in this.listeners) {
				delete this.listeners[event];
			}
		}
	}
}
