import type { Bounds, Rect, Plane } from "@common/types";
import type { Atom } from "jotai";
import type { Store } from "jotai/vanilla/store";

export function bindAtom<T>(
	store: Store,
	atom: Atom<T>,
	apply: (value: T) => void,
): () => void {
	apply(store.get(atom));
	return store.sub(atom, () => apply(store.get(atom)));
}

export function clamp(min: number, val: number, max: number): number {
	return Math.min(max, Math.max(min, val));
}

type OptionalKeys<T> = {
	[K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

type RequiredOptionals<T> = {
	[K in OptionalKeys<T>]-?: T[K];
};

export const withDefaultProps = <Props extends object>(
	supplied: Props,
	defaults: RequiredOptionals<Props>,
): Required<Props> => {
	return { ...defaults, ...supplied } as Required<Props>;
};

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
