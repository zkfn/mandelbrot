import { useEffect, useLayoutEffect, useMemo, useRef, type FC } from "react";
import { boundsToRect } from "@common/utils";
import { ReadAndClearFlag } from "@common/flag";
import { Tile, TileSetter, TileState } from "@lib/tiles";
import { PlaneGrid } from "@lib/grid";
import type { Plane } from "@common/types";
import { TileStore } from "@lib/store";
import { TileJobQueue } from "@lib/queue";
import { WorkerExecutor } from "@lib/executor";

interface GridViewerProps {
	plane: Plane;
}

const GridViewer: FC<GridViewerProps> = ({ plane }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null!);
	const tileSetter = useMemo(() => new TileSetter(plane), [plane]);
	const dirtyFlagRef = useRef<ReadAndClearFlag>(new ReadAndClearFlag(true));
	const planeGridRef = useRef<PlaneGrid>(null!);
	const tileStore = useRef<TileStore>(null!);
	const tileQueue = useRef<TileJobQueue>(null!);
	const executor = useRef<WorkerExecutor>(null!);
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

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.strokeStyle = "#000";
		ctx.lineWidth = 1;

		function colorFor(state: TileState): string {
			if (state === TileState.READY) return "#0f0";
			if (state === TileState.RENDERING) return "#ff4";
			else return "#aa0";
		}

		const paintTiles = (tiles: Tile[]) => {
			for (const tile of tiles) {
				const camBounds = planeGrid.planeBoundsToCamera(tile.section);

				const { minX, minY } = camBounds;
				const { width, height } = boundsToRect(camBounds);

				const record = tileStore.current.getTileRecord(tile.key.id());

				if (record && record.state != TileState.QUEUED) {
					ctx.fillStyle = colorFor(record.state);
					ctx.fillRect(minX, minY, width, height);
					ctx.strokeRect(minX, minY, width, height);
				}
			}
		};

		const processTiles = (tiles: Tile[]) => {
			for (const tile of tiles) {
				const record = tileStore.current.getTileRecord(tile.key.id());

				if (!record || record.state == TileState.QUEUED) {
					tileQueue.current.push(tile);
					tileStore.current.setQueued(tile.key.id());
				}
			}
		};

		const desiredDepth = planeGrid.optimalDepthLevelPerResolution(256);
		const coarserDepth = desiredDepth - 1;
		const blurDepth = desiredDepth - 2;

		const desiredTiles = tileSetter.layTiles(camera, desiredDepth);
		const coarserTiles = tileSetter.layTiles(camera, coarserDepth);
		const blurTiles = tileSetter.layTiles(camera, blurDepth);

		tileQueue.current.nextGeneration();

		processTiles(blurTiles);
		processTiles(coarserTiles);
		processTiles(desiredTiles);

		tileStore.current.prune();
		executor.current.pump();

		paintTiles(blurTiles);
		paintTiles(coarserTiles);
		paintTiles(desiredTiles);
	}

	useLayoutEffect(() => {
		const dirtyFlag = assertDirtyFlag();
		const canvas = assertCanvas();

		const planeGrid = new PlaneGrid(plane, dirtyFlag);

		planeGrid.initCanvas(canvas);
		planeGridRef.current = planeGrid;

		tileQueue.current = new TileJobQueue();
		tileStore.current = new TileStore();
		executor.current = new WorkerExecutor(
			tileStore.current,
			tileQueue.current,
			dirtyFlag,
		);

		return () => {
			planeGrid.deinitCanvas();

			planeGridRef.current = null!;
			// TODO: Deinit the queue and stuff;
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
