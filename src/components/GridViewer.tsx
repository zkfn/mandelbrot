import { useLayoutEffect, useMemo, useRef, type FC } from "react";
import { PlaneGridHandler } from "@lib/grid";
import type { Plane } from "@common/types";
import ControlPanel from "./ControlPanel";

interface GridViewerProps {
	plane: Plane;
}

const GridViewer: FC<GridViewerProps> = ({ plane }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null!);
	const planeGrid = useMemo<PlaneGridHandler>(
		() => new PlaneGridHandler(plane),
		[plane],
	);

	const assertCanvas = (): HTMLCanvasElement => {
		if (!canvasRef.current) {
			throw Error("Canvas ref is empty.");
		}

		return canvasRef.current;
	};

	useLayoutEffect(() => {
		const canvas = assertCanvas();
		planeGrid.attachToCanvas(canvas);

		return () => {
			planeGrid.deattachFromCanvas();
		};
	}, [plane]);

	return (
		<>
			<canvas
				ref={canvasRef}
				style={{
					width: "100%",
					height: "100%",
					display: "block",
				}}
			/>
			<ControlPanel
				poolSize={planeGrid.getPoolSize()}
				onPoolSizeSet={(size) => planeGrid.setPoolSize(size)}
				onRequestWorkerBusyness={() => planeGrid.getWorkerBusyness()}
			/>
		</>
	);
};

export default GridViewer;
