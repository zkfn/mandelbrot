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

export interface Rect {
	width: number;
	height: number;
}

export const rect = (init: Rect | null = null): Rect => {
	if (init == null) {
		return { width: 0, height: 0 };
	} else {
		const { width, height } = init;
		return { width, height };
	}
};

export function boundsToRect(bounds: Bounds): Rect {
	return {
		width: bounds.maxX - bounds.minX,
		height: bounds.maxY - bounds.minY,
	};
}

export function aspectRatio(width: number, height: number): number;
export function aspectRatio(rect: Rect): number;
export function aspectRatio(bounds: Bounds): number;
export function aspectRatio(a: number | Rect | Bounds, b?: number): number {
	if (typeof a === "number" && typeof b === "number") {
		return a / b;
	}

	const rect =
		"maxX" in (a as object) ? boundsToRect(a as Bounds) : (a as Rect);

	return rect.width / rect.height;
}

export const fitCameraIntoPlane = (
	planeBounds: Bounds,
	cameraRect: Rect,
): [Bounds, number] => {
	const planeRect = boundsToRect(planeBounds);
	const planeAspect = aspectRatio(planeRect);
	const cameraAspect = aspectRatio(cameraRect);

	let cameraBounds: Bounds;
	let unitPerPixel: number;

	if (cameraAspect >= planeAspect) {
		unitPerPixel = planeRect.width / cameraRect.width;

		const cameraToPlaneHeight = unitPerPixel * cameraRect.height;
		const complementaryPlane = planeRect.height - cameraToPlaneHeight;

		cameraBounds = {
			minX: planeBounds.minX,
			maxX: planeBounds.maxX,
			minY: planeBounds.minY + complementaryPlane / 2,
			maxY: planeBounds.maxY - complementaryPlane / 2,
		};
	} else {
		unitPerPixel = planeRect.height / cameraRect.height;
		const cameraToPlaneWidth = unitPerPixel * cameraRect.width;
		const complementaryPlane = planeRect.width - cameraToPlaneWidth;

		cameraBounds = {
			minY: planeBounds.minX + complementaryPlane / 2,
			maxY: planeBounds.maxX - complementaryPlane / 2,
			minX: planeBounds.minY,
			maxX: planeBounds.maxY,
		};
	}

	return [cameraBounds, unitPerPixel];
};
