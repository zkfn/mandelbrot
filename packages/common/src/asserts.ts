export class AssertionError extends Error {}

export function assert(
	value: boolean,
	message: string = "Assertion failed",
): asserts value {
	if (!value) {
		throw new AssertionError(message);
	}
}

export function assertGtZero(value: number, message?: string) {
	assert(value > 0, message);
}
