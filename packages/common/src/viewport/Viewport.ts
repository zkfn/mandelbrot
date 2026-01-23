import type { Calc, RectPoints, RectWH, Vec2 } from "../numeric";
import { computeGridLinesFactory, type GridLinesCalc } from "./PlaneGrid";

/**
 * Zooming
 * -------
 *
 * viewport width (measure in units)
 * widthPx * unitsPerPixel
 * unitsPerPixel = 1 / 2**zoom2Exp
 */

export class Viewport<T> {
  private calc: Calc<T>;
  private gridLinesCalc: GridLinesCalc<T>;

  private zoom2Exp: number;
  private inPixels: RectWH<number>;
  private center: Vec2<T>;
  private angleRad: number;
  private dirty: boolean;

  public constructor(calc: Calc<T>, aspect: RectWH<number>, center?: Vec2<T>, angleRad?: number) {
    this.calc = calc;
    this.gridLinesCalc = computeGridLinesFactory(calc);

    this.inPixels = { ...aspect };
    this.zoom2Exp = 10;
    this.center = center ?? { x: this.calc.zero(), y: this.calc.zero() };
    this.angleRad = angleRad ?? 0;

    this.dirty = true;
  }

  public moveBy(offset: Vec2<T>) {
    const { x: offX, y: offY } = offset;
    const { x, y } = this.center;

    this.center = {
      x: this.calc.sub(x, offX),
      y: this.calc.sub(y, offY),
    };

    this.dirty = true;
  }

  public resize(aspect: RectWH<number>): void {
    this.inPixels = { ...aspect };
    this.dirty = true;
  }

  // TODO: zoom at focus point
  public zoomAtPixels(zoom2Exp: number, _focusPoint?: Vec2<number>) {
    this.zoom2Exp = zoom2Exp;
    this.dirty = true;
  }

  public getCenter(): Vec2<T> {
    return {
      x: this.calc.copy(this.center.x),
      y: this.calc.copy(this.center.y),
    };
  }

  public getAngleRad(): number {
    return this.angleRad;
  }

  public getUnitsPerPixel(): T {
    return this.calc.inv2Exp(this.zoom2Exp);
  }

  public readAndClearDirty() {
    const wasDirty = this.dirty;
    this.dirty = false;

    return wasDirty;
  }

  public getBoundsImgPlane(): RectPoints<T> {
    const { width, height } = this.inPixels;

    const halfWidthPx = width / 2;
    const halfHeightPx = height / 2;
    const unitsPerPixel = this.getUnitsPerPixel();

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

    return {
      topleft,
      bottomright,
    };
  }

  public getGridLines(gapPx: number) {
    return this.gridLinesCalc(gapPx, this.zoom2Exp, this.inPixels, this.getBoundsImgPlane());
  }
}
