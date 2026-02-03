import { NumberCalc, Viewport } from "@mandelbrot/common";
import { createSignal, type JSX, onMount } from "solid-js";
import { createCanvasEvents } from "../utils/canvasEvents";
import { createPointerEvents } from "../utils/pointerEvents";
import { CoordinateTooltip, type TooltipState } from "./CoordinateTooltip";

type MandelbrotViewProps = JSX.HTMLAttributes<HTMLDivElement>;

const MandelbrotView = (props: MandelbrotViewProps) => {
  let canvasRef!: HTMLCanvasElement;
  let wrapperRef!: HTMLDivElement;
  const viewport = new Viewport(NumberCalc, canvasRef);

  const [tooltip, setTooltip] = createSignal<TooltipState>({
    x: 0,
    y: 0,
    planeX: 0,
    planeY: 0,
    visible: false,
    containerWidth: 0,
    containerHeight: 0,
  });

  const redraw = () => {
    const ctx = canvasRef.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.fillStyle = "green";
    ctx.rect(0, 0, canvasRef.width, canvasRef.height);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "red";
    ctx.rect(canvasRef.width - 60, canvasRef.height - 60, 50, 50);
    ctx.rect(canvasRef.width / 2 - 50, canvasRef.height / 2 - 50, 100, 100);
    ctx.fill();

    const drawLines = (gap: number, stroke: number, showLabels: boolean) => {
      const { horizontalLines, verticalLines } = viewport.getGridLines(gap);

      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";

      for (const line of [...horizontalLines, ...verticalLines]) {
        ctx.beginPath();
        ctx.moveTo(line.aPx.x, line.aPx.y);
        ctx.lineTo(line.bPx.x, line.bPx.y);
        ctx.lineWidth = stroke;
        ctx.stroke();
      }

      if (showLabels) {
        const dpr = window.devicePixelRatio || 1;
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.font = `${10 * dpr}px monospace`;

        for (const line of verticalLines) {
          ctx.save();
          ctx.translate(line.aPx.x + 4 * dpr, 16 * dpr);
          ctx.fillText(line.label, 0, 0);
          ctx.restore();
        }

        for (const line of horizontalLines) {
          ctx.save();
          ctx.translate(4 * dpr, line.aPx.y - 4 * dpr);
          ctx.fillText(line.label, 0, 0);
          ctx.restore();
        }
      }
    };

    drawLines(75, 1, false);
    drawLines(150, 2, false);
    drawLines(300, 3, true);
  };

  const resizeCanvas = () => {
    const DPR = window.devicePixelRatio || 1;
    const width = Math.round(wrapperRef.clientWidth * DPR);
    const height = Math.round(wrapperRef.clientHeight * DPR);

    canvasRef.width = width;
    canvasRef.height = height;

    viewport.resize({ width, height });

    canvasRef.style.width = `${wrapperRef.clientWidth}px`;
    canvasRef.style.height = `${wrapperRef.clientHeight}px`;

    redraw();
  };

  const render = (_deltaMillis: number) => {
    if (viewport.readAndClearDirty()) {
      redraw();
    }
  };

  onMount(() => {
    let raf = 0;
    let prevT = Date.now();
    let deltaT = 0;

    const loop = () => {
      render(deltaT);

      const nowT = Date.now();
      deltaT = prevT - nowT;
      prevT = nowT;

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    const cancelEvents = createCanvasEvents(wrapperRef, resizeCanvas);
    const cancelRaf = () => cancelAnimationFrame(raf);

    return () => {
      cancelEvents();
      cancelRaf();
    };
  });

  const pointerEvents = createPointerEvents({
    canvas: canvasRef,

    onZoom: (by, mx, my) =>
      viewport.zoomByAtPixels(by, {
        x: (mx - canvasRef.clientLeft) * window.devicePixelRatio,
        y: (my - canvasRef.clientTop) * window.devicePixelRatio,
      }),

    onMove: (x, y) =>
      viewport.moveByPixels({
        x: x * window.devicePixelRatio,
        y: y * window.devicePixelRatio,
      }),

    onPointerPosition: (xPx, yPx) => {
      const rect = canvasRef.getBoundingClientRect();

      const x = xPx - rect.left;
      const y = yPx - rect.top;
      const dpr = window.devicePixelRatio || 1;

      const planeCoords = viewport.pixelToPlane({
        x: x * dpr,
        y: y * dpr,
      });

      setTooltip({
        x,
        y,
        planeX: planeCoords.x,
        planeY: planeCoords.y,
        visible: true,
        containerWidth: wrapperRef.clientWidth,
        containerHeight: wrapperRef.clientHeight,
      });
    },
  });

  const handleMouseLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }} {...props}>
      <canvas
        style={{ "touch-action": "none" }}
        ref={canvasRef}
        onMouseLeave={handleMouseLeave}
        {...pointerEvents}
      />
      <CoordinateTooltip {...tooltip()} />
    </div>
  );
};

export default MandelbrotView;
