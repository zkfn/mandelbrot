export interface Bounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
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

export interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export const rect = (init: Partial<Rect> | null = null): Rect => {
	if (init == null) {
		return { top: 0, left: 0, width: 0, height: 0 };
	} else {
		const { top, left, width, height } = init;
		return {
			left: left || 0,
			top: top || 0,
			width: width || 0,
			height: height || 0,
		};
	}
};

// export function boundsToRect(bounds: Bounds): Rect {
// 	return {
// 		left: bounds.minX,
// 		top: bounds.minY,
// 		width: bounds.maxX - bounds.minX,
// 		height: bounds.maxY - bounds.minY,
// 	};
// }
