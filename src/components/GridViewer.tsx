import { useEffect, useLayoutEffect, useRef, type FC } from "react";
import { boundsToRect } from "@common/utils";
import { ReadAndClearFlag } from "@common/flag";
import { Tile, TileSetter } from "@lib/tiles";
import { PlaneGrid } from "@lib/grid";
import type { Plane } from "@common/types";

interface GridViewerProps {
	plane: Plane;
}

const GridViewer: FC<GridViewerProps> = ({ plane }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null!);

	const dirtyFlag = new ReadAndClearFlag(true);
	const planeGrid = new PlaneGrid(plane, dirtyFlag);
	const tileSetter = new TileSetter(plane);

	function draw() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const camera = planeGrid.getCameraBounds();
		const W = canvas.width;
		const H = canvas.height;

		const desiredDepth = planeGrid.optimalDepthLevelPerResolution(256);

		ctx.clearRect(0, 0, W, H);
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, W, H);
		ctx.strokeStyle = "#000";
		ctx.lineWidth = 1;

		const paintTiles = (tiles: Tile[]) => {
			for (const tile of tiles) {
				const camBounds = planeGrid.planeBoundsToCamera(tile.section);
				const { minX, minY } = camBounds;
				const { width, height } = boundsToRect(camBounds);

				ctx.fillStyle = "#fff";
				ctx.fillRect(minX, minY, width, height);
				ctx.strokeRect(minX, minY, width, height);
			}
		};

		paintTiles(tileSetter.layTiles(camera, desiredDepth));
	}

	useLayoutEffect(() => {
		if (!canvasRef.current) {
			throw new Error("Canvas current is not set.");
		}

		planeGrid.initCanvas(canvasRef.current);
		return () => planeGrid.deinitCanvas();
	}, []);

	useEffect(() => {
		let raf = 0;

		function tick() {
			if (dirtyFlag.readAndClear()) draw();
			raf = requestAnimationFrame(tick);
		}
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			style={{
				width: "100%",
				height: "100%",
				display: "block",
				cursor: "grab",
			}}
		/>
	);
};

export default GridViewer;
