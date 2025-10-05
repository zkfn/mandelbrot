import {
	Grid,
	type OrchestratorName,
	orchestratorNames,
	resolutionValues,
} from "@mandelbrot/core";
import { useAtom } from "jotai";
import { type FC, useState } from "react";
import useInterval from "../hooks/useInterval";
import BusynessDisplay from "./BusynessDisplay";

interface ControlPanelProps {
	planeGrid: Grid;
}

const ControlPanel: FC<ControlPanelProps> = ({ planeGrid }) => {
	const [poolSize, setPoolSize] = useAtom(planeGrid.poolSize);
	const [resolution, setResolution] = useAtom(planeGrid.tileSize);
	const [iters, setIters] = useAtom(planeGrid.maxIters);
	const [orchName, setOrchNam] = useAtom(planeGrid.orchestratorName);

	const [cacheUse, setCacheUse] = useState(
		planeGrid.orchestrator.getCacheUse(),
	);
	const [cacheCapacity, setCacheCapacity] = useState(
		planeGrid.orchestrator.getCacheCapacity(),
	);
	const [queue, setQueue] = useState(planeGrid.orchestrator.getQueueSize());
	const [busyness, setBusyness] = useState(
		planeGrid.orchestrator.getWorkerBusyness(),
	);

	useInterval(() => {
		setBusyness(planeGrid.orchestrator.getWorkerBusyness());
		setQueue(planeGrid.orchestrator.getQueueSize());
		setCacheUse(planeGrid.orchestrator.getCacheUse());
		setCacheCapacity(planeGrid.orchestrator.getCacheCapacity());
	}, 100);

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
				<select
					name="mode"
					value={orchName}
					onChange={(e) => {
						setOrchNam(e.target.value as OrchestratorName);
					}}
				>
					{orchestratorNames.map((on) => (
						<option value={on}>{on}</option>
					))}
				</select>
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
			{busyness && queue !== null ? (
				<div style={{ display: "flex", flexDirection: "row" }}>
					<p style={{ marginRight: "10px" }}>{queue}</p>
					<BusynessDisplay busyness={busyness} />
				</div>
			) : null}

			<div style={{ display: "flex", flexDirection: "row" }}>
				<p>
					{cacheUse}
					{cacheCapacity ? `/${cacheCapacity}` : ""}
				</p>
			</div>
		</div>
	);
};

export default ControlPanel;
