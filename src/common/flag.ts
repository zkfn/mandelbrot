export const readAndClearMultiple = (...flags: ReadAndClearFlag[]): boolean => {
	let result = false;

	for (const flag of flags) {
		if (flag.readAndClear()) {
			result = true;
		}
	}

	return result;
};

export class ReadAndClearFlag {
	public constructor(private flag: boolean) {}

	public set = () => {
		this.flag = true;
	};

	public readAndClear = () => {
		const previous = this.flag;
		this.flag = false;
		return previous;
	};
}
