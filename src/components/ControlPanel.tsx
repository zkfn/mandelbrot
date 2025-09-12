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
	const [busyness, setBusyness] = useState(planeGrid.getWorkerBusyness());

	useInterval(() => setBusyness(planeGrid.getWorkerBusyness()), 100, [
		planeGrid,
	]);

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
				{poolSize}
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
				{resolution}
			</div>
			{busyness && <BusynessDisplay busyness={busyness} />}
		</div>
	);
};

export default ControlPanel;
