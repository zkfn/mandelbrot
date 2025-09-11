import { useLayoutEffect, useMemo, useRef, type FC } from "react";
import { PlaneGridHandler } from "@lib/grid";
import { Provider } from "jotai";
import ControlPanel from "./ControlPanel";
import type { Plane } from "@common/types";

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
