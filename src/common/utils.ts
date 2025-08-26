import type { Bounds, Rect, Plane } from "@common/types";

export function clamp(min: number, val: number, max: number): number {
	return Math.min(max, Math.max(min, val));
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

export const planeToBounds = (plane: Plane): Bounds => {
	const half = plane.side * 0.5;
	const [cx, cy] = plane.center;

	return {
		minX: cx - half,
		maxX: cx + half,
		minY: cy - half,
		maxY: cy + half,
	};
};
