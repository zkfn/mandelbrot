import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chokidar from "chokidar";
import type { Plugin } from "vite";

const execFileAsync = promisify(execFile);

export type RecompileOpts = {
	cmd: string;
	args?: string[];
	cwd?: string;
	watch?: string[];
	reload?: "full" | "hot";
};

export default function recompile(opts: RecompileOpts): Plugin {
	const {
		cmd,
		args = [],
		cwd = process.cwd(),
		watch = [],
		reload = "full",
	} = opts;

	const run = async (label: string) => {
		try {
			await execFileAsync(cmd, args, {
				cwd,
				env: process.env,
			});
			console.log(`[recompile] ${label}: ok`);
		} catch (err: unknown) {
			console.error(`[recompile] ${label}: fail`);
			console.dir(err);
		}
	};

	return {
		name: "recompile-external",
		apply: "serve",

		async configureServer(server) {
			await run("initial");

			const watcher = chokidar.watch(watch, {
				cwd,
				ignoreInitial: true,
				awaitWriteFinish: {
					stabilityThreshold: 200,
					pollInterval: 50,
				},
			});

			watcher.on("all", async (event, filePath) => {
				if (event === "add" || event === "change" || event === "unlink") {
					await run(`${event}:${filePath}`);
					if (reload === "full") server.ws.send({ type: "full-reload" });
					// for HMR you'd instead invalidate modules via server.moduleGraph
				}
			});
		},

		async buildStart() {
			// This hook runs in both build and serve. Only run once if building.
			if (process.env.NODE_ENV === "production") await run("build");
		},
	};
}
