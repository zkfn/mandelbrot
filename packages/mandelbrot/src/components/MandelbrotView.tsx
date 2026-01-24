import { NumberCalc, Viewport } from "@mandelbrot/common";
import { type JSX, onMount } from "solid-js";
import { createCanvasEvents } from "../utils/canvasEvents";
import { createPointerEvents } from "../utils/pointerEvents";

type MandelbrotViewProps = JSX.HTMLAttributes<HTMLDivElement>;

const MandelbrotView = (props: MandelbrotViewProps) => {
  let canvasRef!: HTMLCanvasElement;
  let wrapperRef!: HTMLDivElement;
  const viewport = new Viewport(NumberCalc, canvasRef);

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

    const drawLines = (gap: number, stroke: number) => {
      const { horizontalLines, verticalLines } = viewport.getGridLines(gap);

      for (const line of [...horizontalLines, ...verticalLines]) {
        ctx.beginPath();
        ctx.moveTo(line.aPx.x, line.aPx.y);
        ctx.lineTo(line.bPx.x, line.bPx.y);
        ctx.lineWidth = stroke;
        ctx.stroke();
      }
    };

    drawLines(50, 1);
    drawLines(100, 2);
    drawLines(200, 3);
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

  const zoom = (by: number) => {
    viewport.zoomByAtPixels(by);
  };

  const pointerEvents = createPointerEvents({
    canvas: canvasRef,
    onZoom: zoom,
    onStop: () => console.log("Stop"),
    onStart: () => console.log("Start"),
    onMove: console.log,
  });

  return (
    <div ref={wrapperRef} {...props}>
      <canvas style={{ "touch-action": "none" }} ref={canvasRef} {...pointerEvents} />
    </div>
  );
};

export default MandelbrotView;
