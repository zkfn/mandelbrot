import { useEffect, useLayoutEffect, useMemo, useRef, type FC } from "react";
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
	const tileSetter = useMemo(() => new TileSetter(plane), [plane]);
	const dirtyFlagRef = useRef<ReadAndClearFlag>(new ReadAndClearFlag(true));
	const planeGridRef = useRef<PlaneGrid>(null!);
	const rafNumber = useRef<number>(0);

	const assertDirtyFlag = (): ReadAndClearFlag => {
		if (!dirtyFlagRef.current) {
			throw Error("Dirty flag ref is empty.");
		}

		return dirtyFlagRef.current;
	};

	const assertAndGetPlaneGrid = (): PlaneGrid => {
		if (!planeGridRef.current) {
			throw Error("Plane grid ref is empty.");
		}

		return planeGridRef.current;
	};

	const assertCanvas = (): HTMLCanvasElement => {
		if (!canvasRef.current) {
			throw Error("Canvas ref is empty.");
		}

		return canvasRef.current;
	};

	const assertAndGetCanvasWithCtx = (): [
		HTMLCanvasElement,
		CanvasRenderingContext2D,
	] => {
		const canvas = assertCanvas();
		const ctx = canvas.getContext("2d");

		if (!ctx) {
			throw Error("Canvas context is empty.");
		}

		return [canvas, ctx];
	};

	function draw() {
		const planeGrid = assertAndGetPlaneGrid();
		const [canvas, ctx] = assertAndGetCanvasWithCtx();
		const camera = planeGrid.getCameraBounds();

		const desiredDepth = planeGrid.optimalDepthLevelPerResolution(256);

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
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
		const dirtyFlag = assertDirtyFlag();
		const canvas = assertCanvas();

		const planeGrid = new PlaneGrid(plane, dirtyFlag);
		planeGrid.initCanvas(canvas);

		planeGridRef.current = planeGrid;

		return () => {
			planeGrid.deinitCanvas();
			planeGridRef.current = null!;
		};
	}, [plane]);

	useEffect(() => {
		const dirtyFlag = assertDirtyFlag();

		function tick() {
			if (dirtyFlag.readAndClear()) draw();
			rafNumber.current = requestAnimationFrame(tick);
		}
		rafNumber.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafNumber.current);
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
