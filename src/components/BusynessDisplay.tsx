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
	const total = busyness.length;
	const busy = busyness.filter(Boolean).length;

	return (
		<div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: `repeat(${perRow}, ${size}px)`,
					gap: 4,
				}}
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
							boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)",
						}}
					/>
				))}
			</div>
			<span style={{ fontSize: 12 }}>
				{busy}/{total} busy
			</span>
		</div>
	);
};

export default BusynessDisplay;
