import type { Vec2 } from "@mandelbrot/common";

const WHEEL_ZOOM_SCALE = 0.002;

type PointerEvents = {
  canvas: HTMLCanvasElement;
  onStart: () => unknown;
  onStop: () => unknown;
  onMove: (deltaXPx: number, deltaYPx: number) => unknown;
  onZoom: (factor: number, midpointXPx: number, midpointYPx: number) => unknown;
  onPointerPosition: (xPx: number, yPx: number) => unknown;
};

export const createPointerEvents = (ctx: Partial<PointerEvents>) => {
  const pointers = new Map<number, Vec2<number>>();
  let lastPinchDist = 0;

  const distance = (a: Vec2<number>, b: Vec2<number>) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  };

  const midpoint = (a: Vec2<number>, b: Vec2<number>) => {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    ctx.onZoom?.(event.deltaY * WHEEL_ZOOM_SCALE, event.clientX, event.clientY);
  };

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    ctx.canvas?.setPointerCapture(event.pointerId);

    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.size === 1) {
      ctx.onStart?.();
    }

    if (pointers.size === 2) {
      const [a, b] = pointers.values();
      lastPinchDist = distance(a, b);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    event.preventDefault();

    ctx.onPointerPosition?.(event.clientX, event.clientY);

    if (!pointers.has(event.pointerId)) {
      return;
    }

    if (pointers.size === 1) {
      const prev = pointers.get(event.pointerId)!;

      pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      const [x0, y0] = [prev.x, prev.y];
      const [cx, cy] = [event.clientX, event.clientY];

      ctx.onMove?.(x0 - cx, y0 - cy);
    }

    if (pointers.size === 2) {
      const [a, b] = pointers.values();
      const dist = distance(a, b);

      if (lastPinchDist > 0) {
        const factor = dist / lastPinchDist;
        const { x: mx, y: my } = midpoint(a, b);

        ctx.onZoom?.(-factor, mx, my);
      }

      lastPinchDist = dist;

      for (const id of pointers.keys()) {
        if (id === event.pointerId) {
          pointers.set(id, {
            x: event.clientX,
            y: event.clientY,
          });
        }
      }
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    event.preventDefault();
    pointers.delete(event.pointerId);

    if (pointers.size <= 1) {
      lastPinchDist = 0;
    }
    if (pointers.size === 0) {
      ctx.onStop?.();
    }
  };

  return {
    onPointerDown,
    onPointerUp,
    "on:pointermove": { handleEvent: onPointerMove, passive: false },
    "on:wheel": { handleEvent: onWheel, passive: false },
  };
};
