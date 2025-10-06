# Mandelbrot Viewer

- Author: Zdeněk Foltýn
- [Hosted here](https://zkfn.github.io/mandelbrot/)

A Mandelbrot set viewer written in TypeScript. Renders the fractal using tiled
computation distributed across Web Workers. Supports both JavaScript and
WebAssembly backends.

## Features

- Zoom into the Mandelbrot set up to the 64-bit floating-point limit.
- The complex plane is split into tiles for efficient computation and caching.
- Workers dynamically reprioritize tiles to focus on what’s visible on screen.
- Progressive rendering: low precision first, then refined results as they
  arrive.
- Adjustable worker pool to balance speed and resource use.
- Cached tiles are reused when panning, avoiding redundant recomputation.
- Both WebAssembly (compiled from Zig) and pure JavaScript execution supported.
- Touchscreen support.

## Project structure

> The WebAssembly backend is built from Zig [(source here)](./packages/zig/).  
> To build locally, install the Zig compiler.

The project is a monorepo organized under [`packages/`](./packages/):

- [`workers/`](./packages/workers/) — main-thread logic (e.g. `WorkerPool`) and
  worker code.
- [`zig/`](./packages/zig/) — Zig source compiled to WebAssembly.
- [`core/`](./packages/core/) — core logic: data structures, events, cache,
  orchestration.
  - [`camera.ts`](./packages/core/src/camera.ts) — camera movement and
    coordinate transforms.
  - [`events.ts`](./packages/core/src/events.ts) — canvas input and camera
    controls.
  - [`cache.ts`](./packages/core/src/cache.ts) — tile cache with time and size
    limits. A tick is issued only when the viewport change causes the visible
    tile set to change, i.e. a pan or zoom that requires new tiles. When a tile
    is used, its age resets.
  - [`composer.ts`](./packages/core/src/composer.ts) — assembles cached tiles
    into the final image and reports cache misses.
  - [`orchestrator.ts`](./packages/core/src/orchestrator.ts) — coordinates
    composer, cache, camera, and workers. Runs each frame
    (`requestAnimationFrame`) and re-renders only when needed.
  - [`grid.ts`](./packages/core/src/grid.ts) — connects orchestrator and events
    into a single class that mounts onto the canvas. Exposes atoms for the
    client.
- [`client/`](./packages/client/) — React + Jotai + Tailwind frontend. Displays
  a fullscreen canvas and a control panel linked to `core/grid.ts`.
