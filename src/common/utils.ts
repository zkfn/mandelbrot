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

export const boundsCenter = (bounds: Bounds): [number, number] => {
	return [(bounds.minX + bounds.maxX) * 0.5, (bounds.minY + bounds.maxY) * 0.5];
};

export const boundsWidth = (bounds: Bounds): number => {
	return bounds.maxX - bounds.minX;
};

export const boundsHeight = (bounds: Bounds): number => {
	return bounds.maxY - bounds.minY;
};

export const rect = (init: Partial<Rect> | null = null): Rect => {
	if (init == null) {
		return { width: 0, height: 0, top: 0, left: 0 };
	} else {
		const { width, height, top, left } = init;
		return {
			left: left || 0,
			top: top || 0,
			width: width || 0,
			height: height || 0,
		};
	}
};

export function boundsToRect(bounds: Bounds): Rect {
	return {
		left: bounds.minX,
		top: bounds.minY,
		width: boundsWidth(bounds),
		height: boundsHeight(bounds),
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
