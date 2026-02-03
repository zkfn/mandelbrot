import type { Calc, RectPoints, RectWH, Vec2 } from "../numeric";
import { computeGridLinesFactory, type GridLinesCalc } from "./PlaneGrid";

export interface ViewportRect<T> {
  center: Vec2<T>;
  zoom2Exp: number;
  pixelSize: RectWH<number>;
}

interface ViewportInitProps<T> {
  center?: Vec2<T>;
  zoom2Exp?: number;
  pixelSize: RectWH<number>;
}

export class Viewport<T> implements ViewportRect<T> {
  public center: Vec2<T>;
  public zoom2Exp: number;
  public pixelSize: RectWH<number>;

  private calc: Calc<T>;
  private gridLinesCalc: GridLinesCalc<T>;

  public constructor({ center, zoom2Exp, pixelSize }: ViewportInitProps<T>, calc: Calc<T>) {
    this.calc = calc;
    this.gridLinesCalc = computeGridLinesFactory(this.calc);
    this.center = center ?? { x: this.calc.zero(), y: this.calc.zero() };
    this.zoom2Exp = zoom2Exp ?? 10;
    this.pixelSize = pixelSize;
  }

  public getUnitsPerPixel(): T {
    return this.calc.inv2Exp(this.zoom2Exp);
  }

  public getBounds(): RectPoints<T> {
    const { width, height } = this.pixelSize;
    const unitsPerPixel = this.getUnitsPerPixel();

    const halfWidthPx = width / 2;
    const halfHeightPx = height / 2;

    const halfWidth = this.calc.multNum(halfWidthPx, unitsPerPixel);
    const halfHeight = this.calc.multNum(halfHeightPx, unitsPerPixel);

    const topleft: Vec2<T> = {
      x: this.calc.sub(this.center.x, halfWidth),
      y: this.calc.sub(this.center.y, halfHeight),
    };

    const bottomright: Vec2<T> = {
      x: this.calc.add(this.center.x, halfWidth),
      y: this.calc.add(this.center.y, halfHeight),
    };

    return { topleft, bottomright };
  }

  public pixelToPlane(pixelPos: Vec2<number>): Vec2<T> {
    const upp = this.getUnitsPerPixel();

    const centerOffsetPx = {
      x: pixelPos.x - this.pixelSize.width / 2,
      y: pixelPos.y - this.pixelSize.height / 2,
    };

    return {
      x: this.calc.add(this.calc.multNum(centerOffsetPx.x, upp), this.center.x),
      y: this.calc.add(this.calc.multNum(centerOffsetPx.y, upp), this.center.y),
    };
  }

  public planeToPixel(planePos: Vec2<T>): Vec2<number> {
    const offsetPlane = {
      x: this.calc.sub(planePos.x, this.center.x),
      y: this.calc.sub(planePos.y, this.center.y),
    };

    return {
      x: this.calc.mult2ExpShouldBeInt(this.zoom2Exp, offsetPlane.x) + this.pixelSize.width / 2,
      y: this.calc.mult2ExpShouldBeInt(this.zoom2Exp, offsetPlane.y) + this.pixelSize.height / 2,
    };
  }

  public getGridLines(gapPx: number) {
    return this.gridLinesCalc(gapPx, this.zoom2Exp, this.pixelSize, this.getBounds());
  }
}
