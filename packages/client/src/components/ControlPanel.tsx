import { range } from "@mandelbrot/common/utils";
import {
	Grid,
	type OrchestratorName,
	orchestratorNames,
} from "@mandelbrot/core";
import { useAtom } from "jotai";
import { EyeOff, Settings2 } from "lucide-react";
import { type FC, useState } from "react";
import useInterval from "../hooks/useInterval";
import BusynessDisplay from "./BusynessDisplay";

interface ControlPanelProps {
	planeGrid: Grid;
}

const MIN_TILE_SIZE_EXP = 7;
const MAX_TILE_SIZE_EXP = 11;

const tileSizeValues = range(MIN_TILE_SIZE_EXP, MAX_TILE_SIZE_EXP).map(
	(e) => 2 ** e,
);

const maxCores = Math.max(navigator?.hardwareConcurrency || 8, 8);

const ControlPanel: FC<ControlPanelProps> = ({ planeGrid }) => {
	const [poolSize, setPoolSize] = useAtom(planeGrid.poolSize);
	const [tileSize, setResolution] = useAtom(planeGrid.tileSize);
	const [iters, setIters] = useAtom(planeGrid.maxIters);
	const [orchName, setOrchNam] = useAtom(planeGrid.orchestratorName);
	const [open, setOpen] = useState(true);

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

	if (open) {
		return (
			<div className="absolute rounded-xl right-4 top-4 z-10 border border-zinc-800/60 bg-zinc-900/50 p-4 text-zinc-100 text-sm backdrop-blur-xl flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<label className="w-full tracking-wide ">Renderer</label>
					<select
						className="rounded-lg w-30 rounded-full shrink-0 border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs outline-none focus:border-blue-500"
						name="mode"
						value={orchName}
						onChange={(e) => {
							setOrchNam(e.target.value as OrchestratorName);
						}}
					>
						{orchestratorNames.map((on) => (
							<option key={on} value={on}>
								{on}
							</option>
						))}
					</select>
				</div>
				<div className="flex items-center gap-3">
					<label className="tracking-wide ">Workers</label>
					<input
						className="w-full accent-blue-500"
						type="range"
						min={1}
						max={maxCores}
						step={1}
						value={poolSize}
						onChange={(e) => setPoolSize(e.currentTarget.valueAsNumber)}
						style={{ width: 180, display: "block" }}
					/>
					<span className="min-w-15 rounded-full border border-zinc-700 bg-zinc-800 px-0.5 py-0.5 text-center text-xs font-medium">
						{poolSize}
					</span>
				</div>
				<div className="flex items-center gap-3">
					<label className="tracking-wide shrink-0">Tile size</label>
					<input
						className="w-full accent-blue-500"
						type="range"
						min={0}
						max={tileSizeValues.length - 1}
						step={1}
						value={tileSizeValues.indexOf(tileSize)}
						onChange={(e) => {
							setResolution(tileSizeValues[e.currentTarget.valueAsNumber]);
						}}
					/>
					<span className="min-w-15 rounded-full border border-zinc-700 bg-zinc-800 px-0.5 py-0.5 text-center text-xs font-medium">
						{tileSize}px
					</span>
				</div>
				<div className="flex items-center gap-3">
					<label className="tracking-wide shrink-0">Max iterations</label>
					<input
						className="w-full accent-blue-500"
						type="range"
						min={50}
						max={3500}
						step={150}
						value={iters}
						onChange={(e) => {
							setIters(e.currentTarget.valueAsNumber);
						}}
					/>
					<span className="min-w-15 rounded-full border border-zinc-700 bg-zinc-800 px-0.5 py-0.5 text-center text-xs font-medium">
						{iters}
					</span>
				</div>
				<hr className="text-zinc-200" />
				<div className="flex items-center gap-3">
					<label className="w-full tracking-wide">Worker business</label>
					<BusynessDisplay busyness={busyness} />
				</div>
				<div className="flex items-center gap-3">
					<label className="w-full tracking-wide">Job queue</label>
					<p className="shrink-0">{queue} tiles</p>
				</div>
				<div className="flex items-center gap-3">
					<label className="w-full tracking-wide">Cached</label>
					<p className="shrink-0">
						{cacheUse}
						{cacheCapacity ? `/${cacheCapacity}` : ""} tiles
					</p>
				</div>
				<button
					onClick={() => setOpen((v) => !v)}
					className="p-2 flex w-20 self-center justify-center items-center rounded-lg transition hover:bg-zinc-800/80"
					title="Toggle control panel"
				>
					<EyeOff size={16} />
				</button>
			</div>
		);
	} else {
		return (
			<button
				className="absolute rounded-xl right-4 top-4 z-10 border border-zinc-800/60 bg-zinc-900/50 p-2 text-zinc-100 backdrop-blur-xl flex flex-col gap-2"
				onClick={() => setOpen((v) => !v)}
				title="Toggle control panel"
			>
				<Settings2 size={16} />
			</button>
		);
	}
};

export default ControlPanel;
