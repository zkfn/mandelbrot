import type { FC } from "react";

interface ControlPanelProps {
	onRequestWorkerBusyness: () => boolean[] | null;
	onPoolSizeSet: (poolSize: number) => void;
	poolSize: number;
}

const ControlPanel: FC<ControlPanelProps> = ({ onPoolSizeSet, poolSize }) => {
	return (
		<div>
			<input
				type="range"
				min={1}
				max={7}
				step={1}
				value={poolSize}
				onChange={(e) => onPoolSizeSet(e.currentTarget.valueAsNumber)}
				style={{ width: 180, display: "block" }}
			/>
		</div>
	);
};

export default ControlPanel;
