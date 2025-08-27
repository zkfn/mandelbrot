import type { Bounds, Plane } from "@common/types";
import {
	bounds,
	boundsCenter,
	boundsHeight,
	boundsWidth,
	planeToBounds,
} from "@common/utils";

export class Viewport {
	private readonly planeSideSize: number;
	private readonly planeBounds: Bounds;
	private viewBounds: Bounds;

	public constructor(plane: Plane) {
		this.planeSideSize = plane.side;
		this.planeBounds = planeToBounds(plane);
		this.viewBounds = bounds(this.planeBounds);
	}

	public resize(width: number, height: number, center?: [number, number]) {
		const [cx, cy] = center || this.center();

		const horizontalProportion = (cx - this.viewBounds.minX) / this.width();
		const verticalProportion = (cy - this.viewBounds.minY) / this.height();

		const minX = cx - width * horizontalProportion;
		const minY = cy - height * verticalProportion;

		const maxX = minX + width;
		const maxY = minY + height;

		this.viewBounds = {
			minX,
			maxX,
			minY,
			maxY,
		};

		this.clampToPlane();
	}

	public moveBy(dx: number, dy: number) {
		this.viewBounds.minX += dx;
		this.viewBounds.maxX += dx;
		this.viewBounds.minY += dy;
		this.viewBounds.maxY += dy;

		this.clampToPlane();
	}

	public bounds(): Bounds {
		return bounds(this.viewBounds);
	}

	public minX(): number {
		return this.viewBounds.minX;
	}

	public minY(): number {
		return this.viewBounds.minY;
	}

	private center(): [number, number] {
		return boundsCenter(this.viewBounds);
	}

	private width(): number {
		return boundsWidth(this.viewBounds);
	}

	private height(): number {
		return boundsHeight(this.viewBounds);
	}

	private clampToPlane() {
		let { minX, minY } = this.viewBounds;

		const width = this.width();
		const height = this.height();

		if (width > this.planeSideSize) {
			const halfOverreach = (width - this.planeSideSize) / 2;
			minX = this.planeBounds.minX - halfOverreach;
		} else {
			const maxMinX = this.planeBounds.maxX - width;
			if (minX < this.planeBounds.minX) minX = this.planeBounds.minX;
			if (minX > maxMinX) minX = maxMinX;
		}

		if (height > this.planeSideSize) {
			const halfOverreach = (height - this.planeSideSize) / 2;
			minY = this.planeBounds.minY - halfOverreach;
		} else {
			const maxMinY = this.planeBounds.maxY - height;
			if (minY < this.planeBounds.minY) minY = this.planeBounds.minY;
			if (minY > maxMinY) minY = maxMinY;
		}

		this.viewBounds = {
			minX,
			maxX: minX + width,
			minY,
			maxY: minY + height,
		};
	}
}
