import { useAtom } from "jotai";
import type { PlaneGridHandler } from "@lib/grid";
import type { FC } from "react";

interface ControlPanelProps {
	planeGrid: PlaneGridHandler;
}

const ControlPanel: FC<ControlPanelProps> = ({ planeGrid }) => {
	const [poolSize, setPoolSize] = useAtom(planeGrid.poolSize);
	const [resolution, setResolution] = useAtom(planeGrid.resolution);

	return (
		<div>
			<input
				type="range"
				min={1}
				max={7}
				step={1}
				value={poolSize}
				onChange={(e) => setPoolSize(e.currentTarget.valueAsNumber)}
				style={{ width: 180, display: "block" }}
			/>
			<input
				type="range"
				min={1}
				max={4}
				step={1}
				value={Math.log2(resolution / 64)}
				onChange={(e) => {
					const base = 64;
					const mutiplicated = 2 ** e.currentTarget.valueAsNumber;
					setResolution(base * mutiplicated);
				}}
				style={{ width: 180, display: "block" }}
			/>
		</div>
	);
};

export default ControlPanel;
