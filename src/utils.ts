export function clamp(min: number, val: number, max: number): number {
	return Math.min(max, Math.max(min, val));
}
