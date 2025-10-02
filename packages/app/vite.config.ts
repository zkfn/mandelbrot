import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	root: __dirname,
	plugins: [react()],
	cacheDir: "../../node_modules/.vite/",
});
