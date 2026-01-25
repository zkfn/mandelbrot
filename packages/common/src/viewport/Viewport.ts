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

  public moveByPixels({ x: offsetX, y: offsetY }: Vec2<number>) {
    const upp = this.getUnitsPerPixel();

    this.moveByUnits({
      x: this.calc.multNum(offsetX, upp),
      y: this.calc.multNum(offsetY, upp),
    });
  }

  public moveByUnits(offset: Vec2<T>) {
    const { x: offX, y: offY } = offset;
    const { x, y } = this.center;

    this.center = {
      x: this.calc.add(x, offX),
      y: this.calc.add(y, offY),
    };

    this.dirty = true;
  }

  public resize(aspect: RectWH<number>): void {
    this.inPixels = { ...aspect };
    this.dirty = true;
  }

  public zoomByAtPixels(deltaZoom2Exp: number, focusPointPx: Vec2<number>) {
    const uppBefore = this.getUnitsPerPixel();

    const centerOffsetPx = {
      x: focusPointPx.x - this.inPixels.width / 2,
      y: focusPointPx.y - this.inPixels.height / 2,
    };

    // This point needs to remain mapped to the same pixel after the zoom
    const focusPointPlane = {
      x: this.calc.add(this.calc.multNum(centerOffsetPx.x, uppBefore), this.center.x),
      y: this.calc.add(this.calc.multNum(centerOffsetPx.y, uppBefore), this.center.y),
    };

    this.zoom2Exp -= deltaZoom2Exp;
    const uppAfter = this.getUnitsPerPixel();

    const centerOffsetPlaneAfter = {
      x: this.calc.multNum(centerOffsetPx.x, uppAfter),
      y: this.calc.multNum(centerOffsetPx.y, uppAfter),
    };

    this.center = {
      x: this.calc.sub(focusPointPlane.x, centerOffsetPlaneAfter.x),
      y: this.calc.sub(focusPointPlane.y, centerOffsetPlaneAfter.y),
    };

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
