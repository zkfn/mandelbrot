import type { Vec2 } from "@mandelbrot/common";

const WHEEL_ZOOM_SCALE = 0.002;

type PointerEvents = {
  onStart: () => unknown;
  onStop: () => unknown;
  onMove: (deltaXPx: number, deltaYPx: number) => unknown;
  onZoom: (factor: number, midpointXPx: number, midpointYPx: number) => unknown;
};

export const createPointerEvents = (canvas: HTMLCanvasElement, events: Partial<PointerEvents>) => {
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

    events.onZoom?.(event.deltaY * WHEEL_ZOOM_SCALE, event.clientX, event.clientY);
  };

  const onPointerDown = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();

    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.size === 1) {
      events.onStart?.();
    }

    if (pointers.size === 2) {
      const [a, b] = pointers.values();
      lastPinchDist = distance(a, b);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    event.preventDefault();

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

      events.onMove?.(x0 - cx, y0 - cy);
    }

    if (pointers.size === 2) {
      const [a, b] = pointers.values();
      const dist = distance(a, b);

      if (lastPinchDist > 0) {
        const factor = dist / lastPinchDist;
        const { x: mx, y: my } = midpoint(a, b);

        events.onZoom?.(factor, mx, my);
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
    pointers.delete(event.pointerId);
    if (pointers.size <= 1) {
      lastPinchDist = 0;
    }
    if (pointers.size === 0) {
      events.onStop?.();
    }
  };

  return {
    onPointerDown,
    onPointerUp,
    onPointerMove,
    onWheel,
  };
};
