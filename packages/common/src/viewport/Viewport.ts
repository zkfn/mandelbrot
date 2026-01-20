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

export class Viewport<T> {
  private calc: Calc<T>;

  private unitsPerPixel: T;
  private inPixels: AspectRatio;
  private center: Vec2<T>;

  public constructor(calc: Calc<T>, aspect: AspectRatio, unitsPerPixel: T, center?: Vec2<T>) {
    this.calc = calc;
    this.inPixels = aspect;
    this.unitsPerPixel = unitsPerPixel;
    this.center = center ?? { x: this.calc.zero(), y: this.calc.zero() };
  }

  public moveBy(offset: Vec2<T>) {
    const { x: offX, y: offY } = offset;
    const { x, y } = this.center;

    this.center = {
      x: this.calc.sub(x, offX),
      y: this.calc.sub(y, offY),
    };
  }

  // TODO: Determine what Zoom means -- how will the "zoom level" be measured?
  public zoomAtPixels(_zoom: T, _focusPoint: Vec2<number>) {}

  public getCenter(): Vec2<T> {
    return {
      x: this.calc.copy(this.center.x),
      y: this.calc.copy(this.center.y),
    };
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
