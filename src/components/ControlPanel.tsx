import { useAtom } from "jotai";
import type { PlaneGridHandler } from "@lib/grid";
import { useState, type FC } from "react";
import { resolutionValues } from "@lib/resolution";
import useInterval from "@lib/hooks/useInterval";
import BusynessDisplay from "./BusynessDisplay";

interface ControlPanelProps {
	planeGrid: PlaneGridHandler;
}

const ControlPanel: FC<ControlPanelProps> = ({ planeGrid }) => {
	const [poolSize, setPoolSize] = useAtom(planeGrid.poolSize);
	const [resolution, setResolution] = useAtom(planeGrid.resolution);
	const [iters, setIters] = useAtom(planeGrid.maxIterations);

	const [busyness, setBusyness] = useState(planeGrid.getWorkerBusyness());
	const [queue, setQueue] = useState(planeGrid.getQueueSize());
	const [time, setTime] = useState(planeGrid.getRenderTimePerTile());

	useInterval(
		() => {
			setBusyness(planeGrid.getWorkerBusyness());
			setQueue(planeGrid.getQueueSize());
			setTime(planeGrid.getRenderTimePerTile());
		},
		100,
		[planeGrid],
	);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div style={{ display: "flex", flexDirection: "row" }}>
				<input
					type="range"
					min={1}
					max={7}
					step={1}
					value={poolSize}
					onChange={(e) => setPoolSize(e.currentTarget.valueAsNumber)}
					style={{ width: 180, display: "block" }}
				/>
				<p>{poolSize}</p>
			</div>
			<div style={{ display: "flex", flexDirection: "row" }}>
				<input
					type="range"
					min={0}
					max={resolutionValues.length - 1}
					step={1}
					value={resolutionValues.indexOf(resolution)}
					onChange={(e) => {
						setResolution(resolutionValues[e.currentTarget.valueAsNumber]);
					}}
					style={{ width: 180, display: "block" }}
				/>
				<p>{resolution}</p>
			</div>
			<div style={{ display: "flex", flexDirection: "row" }}>
				<input
					type="range"
					min={50}
					max={4000}
					step={50}
					value={iters}
					onChange={(e) => {
						setIters(e.currentTarget.valueAsNumber);
					}}
					style={{ width: 180, display: "block" }}
				/>
				<p>{iters}</p>
			</div>
			{time !== null && <p>Time: {time.toFixed(2)} ms</p>}
			{busyness && queue !== null ? (
				<div style={{ display: "flex", flexDirection: "row" }}>
					<p style={{ marginRight: "10px" }}>{queue}</p>
					<BusynessDisplay busyness={busyness} />
				</div>
			) : null}
		</div>
	);
};

export default ControlPanel;
