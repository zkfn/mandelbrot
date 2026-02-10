import { MANDELBROT_BOUNDS, NumberCalc, Viewport, ViewportController } from "@mandelbrot/common";
import { DirtyFlag } from "@mandelbrot/common/utils";
import { createSignal, type JSX, onMount } from "solid-js";
import { createCanvasEvents } from "../utils/canvasEvents";
import { createPointerEvents } from "../utils/pointerEvents";
import Controls, { type ControlsState } from "./Controls";
import { CoordinateTooltip, type TooltipState } from "./CoordinateTooltip";

type MandelbrotViewProps = JSX.HTMLAttributes<HTMLDivElement>;

const ZOOM_STEP = 1;
const ZOOM_ANIMATION_DURATION = 200;

const MandelbrotView = (props: MandelbrotViewProps) => {
  let canvasRef!: HTMLCanvasElement;
  let wrapperRef!: HTMLDivElement;

  const boundsCenter = {
    x: (MANDELBROT_BOUNDS.minX + MANDELBROT_BOUNDS.maxX) / 2,
    y: (MANDELBROT_BOUNDS.minY + MANDELBROT_BOUNDS.maxY) / 2,
  };

  const viewport = new Viewport(
    { pixelSize: { width: 0, height: 0 }, center: boundsCenter },
    NumberCalc
  );

  const viewportController = new ViewportController(NumberCalc, viewport, MANDELBROT_BOUNDS);

  const isDirty = new DirtyFlag(false);

  let initialCenter = { ...boundsCenter };
  let initialZoom = viewport.zoom2Exp;

  let zoomAnimation: {
    startTime: number;
    startZoom: number;
    targetZoom: number;
  } | null = null;

  const [tooltip, setTooltip] = createSignal<TooltipState>({
    x: 0,
    y: 0,
    planeX: 0,
    planeY: 0,
    visible: false,
    containerWidth: 0,
    containerHeight: 0,
  });

  const [controls, setControls] = createSignal<ControlsState>({
    showTooltip: true,
    showLabels: true,
    showGridlines: true,
  });

  const [zoomExponent, setZoomExponent] = createSignal(0);

  const redraw = () => {
    const ctx = canvasRef.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.fillStyle = "green";
    ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);

    ctx.beginPath();
    ctx.fillStyle = "red";
    ctx.rect(canvasRef.width - 60, canvasRef.height - 60, 50, 50);
    ctx.rect(canvasRef.width / 2 - 50, canvasRef.height / 2 - 50, 100, 100);
    ctx.fill();

    const { showGridlines, showLabels } = controls();

    if (showGridlines) {
      const drawLines = (gap: number, stroke: number, drawLabels: boolean) => {
        const { horizontalLines, verticalLines } = viewport.getGridLines(gap);

        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";

        for (const line of [...horizontalLines, ...verticalLines]) {
          ctx.beginPath();
          ctx.moveTo(line.aPx.x, line.aPx.y);
          ctx.lineTo(line.bPx.x, line.bPx.y);
          ctx.lineWidth = stroke;
          ctx.stroke();
        }

        if (drawLabels && showLabels) {
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
    }
  };

  let initialStateSet = false;

  const resizeCanvas = () => {
    const DPR = window.devicePixelRatio || 1;
    const width = Math.round(wrapperRef.clientWidth * DPR);
    const height = Math.round(wrapperRef.clientHeight * DPR);

    canvasRef.width = width;
    canvasRef.height = height;

    viewportController.resize(width, height);

    if (!initialStateSet) {
      viewportController.resetToInitialView();
      initialCenter = { x: viewport.center.x, y: viewport.center.y };
      initialZoom = viewport.zoom2Exp;
      initialStateSet = true;
    }

    setZoomExponent(viewportController.getZoomExponent());

    canvasRef.style.width = `${wrapperRef.clientWidth}px`;
    canvasRef.style.height = `${wrapperRef.clientHeight}px`;

    redraw();
  };

  const easeOutCubic = (t: number): number => {
    return 1 - (1 - t) ** 3;
  };

  const updateZoomAnimation = (now: number) => {
    if (!zoomAnimation) return;

    const elapsed = now - zoomAnimation.startTime;
    const progress = Math.min(elapsed / ZOOM_ANIMATION_DURATION, 1);
    const easedProgress = easeOutCubic(progress);

    const currentZoom =
      zoomAnimation.startZoom +
      (zoomAnimation.targetZoom - zoomAnimation.startZoom) * easedProgress;

    const centerPx = {
      x: viewport.pixelSize.width / 2,
      y: viewport.pixelSize.height / 2,
    };

    const zoomDelta = viewport.zoom2Exp - currentZoom;

    if (Math.abs(zoomDelta) > 0.001) {
      viewportController.zoomByAtPixels(zoomDelta, centerPx);
      setZoomExponent(viewportController.getZoomExponent());
      isDirty.setDirty();
    }

    if (progress >= 1) {
      zoomAnimation = null;
    }
  };

  const render = (now: number) => {
    updateZoomAnimation(now);

    if (isDirty.readAndClear()) {
      redraw();
    }
  };

  onMount(() => {
    let raf = 0;

    const loop = (now: number) => {
      render(now);
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

  const startZoomAnimation = (targetZoom: number) => {
    zoomAnimation = {
      startTime: performance.now(),
      startZoom: viewport.zoom2Exp,
      targetZoom,
    };
  };

  const handleZoomIn = () => {
    const targetZoom = (zoomAnimation?.targetZoom ?? viewport.zoom2Exp) + ZOOM_STEP;
    startZoomAnimation(targetZoom);
  };

  const handleZoomOut = () => {
    const targetZoom = (zoomAnimation?.targetZoom ?? viewport.zoom2Exp) - ZOOM_STEP;
    startZoomAnimation(targetZoom);
  };

  const handleReset = () => {
    viewport.center = { x: initialCenter.x, y: initialCenter.y };
    viewport.zoom2Exp = initialZoom;
    zoomAnimation = null;
    viewportController.moveByUnits({ x: 0, y: 0 });
    setZoomExponent(viewportController.getZoomExponent());
    redraw();
  };

  const clientToCanvas = (x: number, y: number) => {
    return {
      x: (x - canvasRef.clientLeft) * window.devicePixelRatio,
      y: (y - canvasRef.clientTop) * window.devicePixelRatio,
    };
  };

  const computeTooltipLabels = (x: number, y: number) => {
    return viewportController.pixelToPlane(clientToCanvas(x, y));
  };

  const updateTooltipLabels = (x: number, y: number) => {
    const { x: planeX, y: planeY } = computeTooltipLabels(x, y);
    setTooltip((prev) => ({ ...prev, planeX, planeY }));
  };

  const pointerEvents = createPointerEvents({
    canvas: canvasRef,

    onZoom: (by, mx, my) => {
      viewportController.zoomByAtPixels(by, clientToCanvas(mx, my));
      updateTooltipLabels(mx, my);
      setZoomExponent(viewportController.getZoomExponent());
      isDirty.setDirty();
    },

    onMove: (x, y) => {
      viewportController.moveByPixels({
        x: x * window.devicePixelRatio,
        y: y * window.devicePixelRatio,
      });

      isDirty.setDirty();
    },

    onPointerPosition: (xPx, yPx) => {
      if (!controls().showTooltip) return;

      const rect = canvasRef.getBoundingClientRect();

      const x = xPx - rect.left;
      const y = yPx - rect.top;

      const { x: planeX, y: planeY } = computeTooltipLabels(x, y);

      setTooltip({
        x,
        y,
        planeX,
        planeY,
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
      <Controls
        state={controls}
        setState={setControls}
        zoomExponent={zoomExponent}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
        onDisplayChange={() => isDirty.setDirty()}
      />
      {controls().showTooltip && <CoordinateTooltip {...tooltip()} />}
    </div>
  );
};

export default MandelbrotView;
