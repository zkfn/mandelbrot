import type { Calc, RectPoints, RectWH, Vec2 } from "../numeric";

export type GridLine = {
  kind: "vertical" | "horizontal";
  label: string;
  aPx: Vec2<number>;
  bPx: Vec2<number>;
};

export type GridLinesCalc<T> = (
  gapPixels: number,
  zoom2Exp: number,
  pixelViewport: RectWH<number>,
  planeViewport: RectPoints<T>
) => {
  verticalLines: GridLine[];
  horizontalLines: GridLine[];
};

export const computeGridLinesFactory = <T>(calc: Calc<T>): GridLinesCalc<T> => {
  return (
    gapPixels: number,
    zoom2Exp: number,
    pixelViewport: RectWH<number>,
    planeViewport: RectPoints<T>
  ) => {
    const { width: widthPx, height: heightPx } = pixelViewport;
    const { topleft, bottomright } = planeViewport;

    const minGapPlane = calc.multNum(gapPixels, calc.inv2Exp(Math.floor(zoom2Exp)));

    const widthStepsPlane = calc.zeroAlignedSteps(minGapPlane, topleft.x, bottomright.x);

    const heightStepsPlane = calc.zeroAlignedSteps(minGapPlane, topleft.y, bottomright.y);

    const widthPlaneToPx = (planeW: T) =>
      calc.mult2ExpShouldBeInt(zoom2Exp, calc.sub(planeW, topleft.x));

    const heightPlaneToPx = (planeH: T) =>
      calc.mult2ExpShouldBeInt(zoom2Exp, calc.sub(planeH, topleft.y));

    const verticalLines = widthStepsPlane.map((step): GridLine => {
      const x = widthPlaneToPx(step);

      return {
        kind: "vertical",
        label: String(step),
        aPx: { x, y: 0 },
        bPx: { x, y: heightPx },
      };
    });

    const horizontalLines = heightStepsPlane.map((step): GridLine => {
      const y = heightPlaneToPx(step);

      return {
        kind: "horizontal",
        label: String(step),
        aPx: { y, x: 0 },
        bPx: { y, x: widthPx },
      };
    });

    return {
      verticalLines,
      horizontalLines,
    };
  };
};
