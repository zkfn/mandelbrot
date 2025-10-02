/* // TODO repurpouse
export class TilePainter {
	public drawDebugTile(fill: string, stroke: string, bounds: Bounds) {
		if (fill === undefined) return;

		const { minX, minY } = bounds;
		const { width, height } = boundsToRect(bounds);

		this.ctx.fillStyle = fill;
		this.ctx.fillRect(minX, minY, width, height);
		this.ctx.strokeStyle = stroke;
		this.ctx.strokeRect(minX, minY, width, height);
	}
} */
