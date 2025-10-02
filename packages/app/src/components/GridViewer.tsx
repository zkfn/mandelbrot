import type { Plane } from "@mandelbrot/common/types";
import { PlaneGridHandler } from "@mandelbrot/core";
import { Provider } from "jotai";
import { type FC, useLayoutEffect, useMemo, useRef } from "react";
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
	}, [plane, planeGrid]);

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
			<Provider store={planeGrid.store}>
				<ControlPanel planeGrid={planeGrid} />
			</Provider>
		</div>
	);
};

export default GridViewer;
