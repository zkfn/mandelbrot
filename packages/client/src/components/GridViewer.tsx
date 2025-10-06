import type { Plane } from "@mandelbrot/common/types";
import { Grid } from "@mandelbrot/core";
import { Provider } from "jotai";
import { type FC, useLayoutEffect, useRef, useState } from "react";
import ControlPanel from "./ControlPanel";

interface GridViewerProps {
	plane: Plane;
}

const GridViewer: FC<GridViewerProps> = ({ plane }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null!);
	const wrapperRef = useRef<HTMLDivElement>(null!);
	const planeGrid = useRef<Grid>(null!);
	const [ready, setReady] = useState(false);

	useLayoutEffect(() => {
		planeGrid.current = new Grid(plane, canvasRef.current, wrapperRef.current);

		setReady(true);

		return () => {
			planeGrid.current.dispose();
			setReady(false);
		};
	}, [plane, planeGrid]);

	return (
		<div className="relative h-full w-full">
			<div ref={wrapperRef} className="w-full h-full overflow-hidden">
				<canvas ref={canvasRef} className="w-full h-full block" />
			</div>
			{ready && (
				<Provider store={planeGrid.current.store}>
					<ControlPanel planeGrid={planeGrid.current} />
				</Provider>
			)}
		</div>
	);
};

export default GridViewer;
