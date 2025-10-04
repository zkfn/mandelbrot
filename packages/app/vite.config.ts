import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import recompile from "./plugins/vite-plugin-recompile";

const relative = (p: string) => path.resolve(__dirname, p);

// https://vite.dev/config/
export default defineConfig({
	root: __dirname,
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	plugins: [
		react(),
		recompile({
			cmd: "zig",
			args: ["build"],
			cwd: relative("../zig/"),
			watch: ["../zig/src", "../zig/build.zig"].map(relative),
		}),
	],
	cacheDir: "../../node_modules/.vite/",
});
