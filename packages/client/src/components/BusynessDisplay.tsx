import type { FC } from "react";

interface BusynessDisplayProps {
	busyness: boolean[];
	size?: number;
	perRow?: number;
}

const BusynessDisplay: FC<BusynessDisplayProps> = ({
	busyness,
	size = 12,
	perRow = Math.min(8, Math.max(1, busyness.length)),
}) => {
	return (
		<div
			className="grid gap-1"
			style={{ gridTemplateColumns: `repeat(${perRow}, ${size}px)` }}
		>
			{busyness.map((b, i) => (
				<div
					key={i}
					title={`Worker ${i} • ${b ? "busy" : "idle"}`}
					style={{
						width: size,
						height: size,
						borderRadius: 2,
						backgroundColor: b ? "#ef4444" : "#10b981",
					}}
				/>
			))}
		</div>
	);
};

export default BusynessDisplay;
