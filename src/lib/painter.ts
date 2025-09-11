import type { Bounds } from "@common/types";
import { boundsToRect } from "@common/utils";

// TODO repurpouse
export class TilePainter {
	public drawDebugTile(fill: string, stroke: string, bounds: Bounds) {
		this.assertInit();

		if (fill === undefined) return;

		const { minX, minY } = bounds;
		const { width, height } = boundsToRect(bounds);

		this.ctx.fillStyle = fill;
		this.ctx.fillRect(minX, minY, width, height);
		this.ctx.strokeStyle = stroke;
		this.ctx.strokeRect(minX, minY, width, height);
	}
}
