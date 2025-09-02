import { useLayoutEffect, useRef, type FC } from "react";
import { PlaneGridHandler } from "@lib/grid";
import type { Plane } from "@common/types";

interface GridViewerProps {
	plane: Plane;
}

const GridViewer: FC<GridViewerProps> = ({ plane }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null!);
	const planeGridRef = useRef<PlaneGridHandler>(null!);

	const assertCanvas = (): HTMLCanvasElement => {
		if (!canvasRef.current) {
			throw Error("Canvas ref is empty.");
		}

		return canvasRef.current;
	};

	useLayoutEffect(() => {
		const canvas = assertCanvas();
		planeGridRef.current = new PlaneGridHandler(plane, canvas);

		return () => {
			planeGridRef.current.deattachFromCanvas();
			planeGridRef.current = null!;
		};
	}, [plane]);

	return (
		<canvas
			ref={canvasRef}
			style={{
				width: "100%",
				height: "100%",
				display: "block",
			}}
		/>
	);
};

export default GridViewer;
