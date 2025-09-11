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

	const [poolSize, setPoolSize] = planeGrid.usePoolSize();

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
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "auto 200px",
				width: "100%",
				height: "100%",
			}}
		>
			<canvas
				ref={canvasRef}
				style={{
					width: "100%",
					height: "100%",
					display: "block",
				}}
			/>
			<ControlPanel
				poolSize={poolSize}
				onPoolSizeSet={setPoolSize}
				onRequestWorkerBusyness={() => planeGrid.getWorkerBusyness()}
			/>
		</div>
	);
};

export default GridViewer;
