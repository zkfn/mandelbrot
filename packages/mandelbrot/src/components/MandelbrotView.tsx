import { NumberCalc, Viewport } from "@mandelbrot/common";
import { type JSX, onMount } from "solid-js";
import { createCanvasEvents } from "../utils/canvasEvents";

type MandelbrotViewProps = JSX.HTMLAttributes<HTMLDivElement>;

const MandelbrotView = (props: MandelbrotViewProps) => {
  let canvasRef!: HTMLCanvasElement;
  let wrapperRef!: HTMLDivElement;

  onMount(() => {
    let raf = 0;
    let prevT = Date.now();
    let deltaT = 0;

    const viewport = new Viewport(NumberCalc, canvasRef);

    const redraw = () => {
      const ctx = canvasRef.getContext("2d");

      if (!ctx) {
        return;
      }

      ctx.fillStyle = "green";
      ctx.rect(0, 0, canvasRef.width, canvasRef.height);
      ctx.fill();

      const upp = viewport.getUnitsPerPixel();
      const { topleft, bottomright } = viewport.getBoundsImgPlane();

      const minX = topleft.x;
      const maxX = bottomright.x;

      const minY = topleft.y;
      const maxY = bottomright.y;

      const width = maxX - minX;
      const height = maxY - minY;

      for (let x = minX; x < width; x += 0.1) {
        ctx.beginPath();
        ctx.moveTo((x - minX) / upp, 0);
        ctx.lineTo((x - minX) / upp, height / upp);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (let y = minY; y < height; y += 0.1) {
        ctx.beginPath();
        ctx.moveTo(0, (y - minY) / upp);
        ctx.lineTo(width / upp, (y - minY) / upp);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
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

  return (
    <div ref={wrapperRef} {...props}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default MandelbrotView;
