import { useEffect, useLayoutEffect, useRef, type FC } from "react";
import { PlaneGridHandler } from "@lib/grid";
import type { Plane } from "@common/types";

interface GridViewerProps {
	plane: Plane;
}

const GridViewer: FC<GridViewerProps> = ({ plane }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null!);
	const planeGridRef = useRef<PlaneGridHandler>(null!);
	const rafNumber = useRef<number>(0);

	const assertCanvas = (): HTMLCanvasElement => {
		if (!canvasRef.current) {
			throw Error("Canvas ref is empty.");
		}

		return canvasRef.current;
	};

	useLayoutEffect(() => {
		const canvas = assertCanvas();
		const planeGrid = new PlaneGridHandler(plane);

		planeGrid.attachToCanvas(canvas);
		planeGridRef.current = planeGrid;

		return () => {
			planeGrid.deattachFromCanvas();
			planeGridRef.current = null!;
		};
	}, [plane]);

	useEffect(() => {
		function tick() {
			planeGridRef.current.draw();
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
