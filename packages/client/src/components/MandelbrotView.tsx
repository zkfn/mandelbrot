import { type JSX, onMount } from "solid-js";
import { createCanvasEvents } from "../utils/canvasEvents";

type MandelbrotViewProps = JSX.HTMLAttributes<HTMLDivElement>;

const MandelbrotView = (props: MandelbrotViewProps) => {
  let canvasRef!: HTMLCanvasElement;
  let wrapperRef!: HTMLDivElement;

  const resizeCanvas = () => {
    const DPR = window.devicePixelRatio || 1;
    const width = Math.round(wrapperRef.clientWidth * DPR);
    const height = Math.round(wrapperRef.clientHeight * DPR);

    canvasRef.width = width;
    canvasRef.height = height;

    const ctx = canvasRef.getContext("2d");

    if (ctx) {
      ctx.fillStyle = "green";
      ctx.rect(0, 0, canvasRef.width, canvasRef.height);
      ctx.fill();
    }
  };

  onMount(() => {
    return createCanvasEvents(wrapperRef, resizeCanvas);
  });

  return (
    <div ref={wrapperRef} {...props}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default MandelbrotView;
