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

export interface Plane {
	center: [number, number];
	side: number;
}
