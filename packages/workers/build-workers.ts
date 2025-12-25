import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workersDir = resolve(__dirname, "src/workers");
const outputDir = resolve(__dirname, "dist/workers");

const workerFiles = readdirSync(workersDir).filter((file) => file.endsWith(".ts"));

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true });

// Build each worker separately to ensure self-contained bundles
for (const file of workerFiles) {
  const name = file.replace(".ts", "");
  const entry = resolve(workersDir, file);
  const tempDir = resolve(__dirname, `dist/workers-temp-${name}`);

  console.log(`Building ${name}...`);

  await build({
    configFile: false, // Don't use vite.config.ts
    resolve: {
      alias: {
        "@mandelbrot/common": resolve(__dirname, "../common/src"),
      },
    },
    build: {
      emptyOutDir: false, // Don't clean between builds
      rollupOptions: {
        input: { [name]: entry },
        output: {
          format: "es",
          dir: tempDir,
          entryFileNames: "[name].js",
          inlineDynamicImports: true, // This works when there's only one input
        },
        external: (id: string) => {
          return id.startsWith("node:");
        },
      },
    },
  });

  // Move the built file to the final location
  const builtFile = resolve(tempDir, `${name}.js`);
  const finalFile = resolve(outputDir, `${name}.js`);
  renameSync(builtFile, finalFile);

  // Clean up temp directory
  await rm(tempDir, { recursive: true, force: true });

  console.log(`Built ${name} -> ${finalFile}`);
}
