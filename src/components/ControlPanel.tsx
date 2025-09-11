import { useAtom } from "jotai";
import type { PlaneGridHandler } from "@lib/grid";
import type { FC } from "react";

interface ControlPanelProps {
	planeGrid: PlaneGridHandler;
}

const ControlPanel: FC<ControlPanelProps> = ({ planeGrid }) => {
	const [poolSize, setPoolSize] = useAtom(planeGrid.poolSize);

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
		</div>
	);
};

export default ControlPanel;
