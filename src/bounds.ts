export interface Bounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface Rect {
	width: number;
	height: number;
}

export const bounds = (init: Bounds | null = null): Bounds => {
	if (init === null) {
		return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
	} else {
		const { minX, maxX, minY, maxY } = init;
		return {
			minX,
			maxX,
			minY,
			maxY,
		};
	}
};

export const center = (bounds: Bounds): [number, number] => {
	return [(bounds.minX + bounds.maxX) * 0.5, (bounds.minY + bounds.maxY) * 0.5];
};

export const rect = (init: Partial<Rect> | null = null): Rect => {
	if (init == null) {
		return { width: 0, height: 0 };
	} else {
		const { width, height } = init;
		return {
			width: width || 0,
			height: height || 0,
		};
	}
};

export function boundsToRect(bounds: Bounds): Rect {
	return {
		width: bounds.maxX - bounds.minX,
		height: bounds.maxY - bounds.minY,
	};
}
