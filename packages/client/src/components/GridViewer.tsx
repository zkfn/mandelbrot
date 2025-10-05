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
		<div
			style={{
				display: "grid",
				gridTemplateColumns: "auto 200px",
				width: "100%",
				height: "100%",
			}}
		>
			<div
				ref={wrapperRef}
				style={{
					width: "100%",
					height: "100%",
					overflow: "hidden",
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
