export class ReadAndClearFlag {
	public constructor(private flag: boolean) {}

	public set = () => {
		this.flag = true;
	};

	public readAndClear = () => {
		const previous = this.flag;
		this.flag = false;
		if (previous) console.log("Flag cleared");
		return previous;
	};
}
