export class DisposeFlag {
	private disposed: boolean;
	private message: string;

	public constructor(message: string = "Dispose flag was set") {
		this.disposed = false;
		this.message = message;
	}

	public set(): void {
		this.disposed = true;
	}

	public read(): boolean {
		return this.disposed;
	}

	public assertNotDisposed(): void {
		if (this.disposed) {
			throw new Error(this.message);
		}
	}
}

export type Invalidator = () => void;

export class InvalidatorPool {
	private invalidators: Set<Invalidator>;

	public constructor() {
		this.invalidators = new Set();
	}

	public invalidate(): void {
		this.invalidators.forEach((inv) => inv());
	}

	public addInvalidator(inv: Invalidator): void {
		if (this.invalidators.has(inv)) {
			throw new Error("Invalidator was already added.");
		}

		this.invalidators.add(inv);
	}

	public removeInvalidator(inv: Invalidator): void {
		if (!this.invalidators.has(inv)) {
			throw new Error("Removed invalidator was not present");
		}

		this.invalidators.delete(inv);
	}
}

export interface Invalidable {
	addInvalidator(inv: Invalidator): void;
	removeInvalidator(inv: Invalidator): void;
}

export class ReadAndClearFlag {
	private flag: boolean;

	public constructor(initiallySet: boolean) {
		this.flag = initiallySet;
	}

	public set = (): void => {
		this.flag = true;
	};

	public readAndClear = (): boolean => {
		const previous = this.flag;
		this.flag = false;
		return previous;
	};
}
