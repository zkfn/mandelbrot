import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid(), tailwindcss(), cssInjectedByJsPlugin()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.mjs" : "index.cjs"),
    },
    rollupOptions: {
      external: ["solid-js", "solid-js/web"],
    },
    sourcemap: true,
  },
});
