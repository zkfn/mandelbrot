import type { Calc } from "../numeric";

export type AspectRatio = {
  width: number;
  height: number;
};

export type Vec2<T = number> = {
  x: T;
  y: T;
};

export type PointRect<T = number> = {
  topleft: Vec2<T>;
  bottomright: Vec2<T>;
};

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

  private unitsPerPixel: T;
  private inPixels: AspectRatio;
  private center: Vec2<T>;
  private angleRad: number;
  private dirty: boolean;

  public constructor(calc: Calc<T>, aspect: AspectRatio, center?: Vec2<T>, angleRad?: number) {
    this.calc = calc;
    this.inPixels = { ...aspect };
    this.unitsPerPixel = this.calc.inv2Exp(10); // TODO: Set some default
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

  public resize(aspect: AspectRatio): void {
    this.inPixels = { ...aspect };
    this.dirty = true;
  }

  // TODO: zoom at focus point
  public zoomAtPixels(zoom2Exp: number, _focusPoint?: Vec2<number>) {
    this.unitsPerPixel = this.calc.inv2Exp(zoom2Exp);

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
    return this.unitsPerPixel;
  }

  public readAndClearDirty() {
    const wasDirty = this.dirty;
    this.dirty = false;

    return wasDirty;
  }

  public getBoundsImgPlane(): PointRect<T> {
    const { width, height } = this.inPixels;

    const halfWidthPx = width / 2;
    const halfHeightPx = height / 2;

    const halfWidth = this.calc.multNum(this.unitsPerPixel, halfWidthPx);
    const halfHeight = this.calc.multNum(this.unitsPerPixel, halfHeightPx);

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
}
