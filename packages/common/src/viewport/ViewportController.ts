import type { Calc, Vec2 } from "../numeric";
import type { Viewport } from "./Viewport";

export class ViewportController<T> {
  private calc: Calc<T>;
  private rect: Viewport<T>;

  public constructor(calc: Calc<T>, rect: Viewport<T>) {
    this.calc = calc;
    this.rect = rect;
  }

  public moveByPixels({ x: offsetX, y: offsetY }: Vec2<number>) {
    const upp = this.rect.getUnitsPerPixel();

    this.moveByUnits({
      x: this.calc.multNum(offsetX, upp),
      y: this.calc.multNum(offsetY, upp),
    });
  }

  public moveByUnits(offset: Vec2<T>) {
    const { x: offX, y: offY } = offset;
    const { x, y } = this.rect.center;

    this.rect.center = {
      x: this.calc.add(x, offX),
      y: this.calc.add(y, offY),
    };
  }

  public resize(width: number, height: number): void {
    this.rect.pixelSize.width = width;
    this.rect.pixelSize.height = height;
  }

  public zoomByAtPixels(deltaZoom2Exp: number, focusPointPx: Vec2<number>) {
    const uppBefore = this.rect.getUnitsPerPixel();

    const centerOffsetPx = {
      x: focusPointPx.x - this.rect.pixelSize.width / 2,
      y: focusPointPx.y - this.rect.pixelSize.height / 2,
    };

    // This point needs to remain mapped to the same pixel after the zoom
    const focusPointPlane = {
      x: this.calc.add(this.calc.multNum(centerOffsetPx.x, uppBefore), this.rect.center.x),
      y: this.calc.add(this.calc.multNum(centerOffsetPx.y, uppBefore), this.rect.center.y),
    };

    const newZoom2Exp = this.rect.zoom2Exp - deltaZoom2Exp;
    const uppAfter = this.calc.inv2Exp(newZoom2Exp);

    const centerOffsetPlaneAfter = {
      x: this.calc.multNum(centerOffsetPx.x, uppAfter),
      y: this.calc.multNum(centerOffsetPx.y, uppAfter),
    };

    this.rect.zoom2Exp = newZoom2Exp;
    this.rect.center = {
      x: this.calc.sub(focusPointPlane.x, centerOffsetPlaneAfter.x),
      y: this.calc.sub(focusPointPlane.y, centerOffsetPlaneAfter.y),
    };
  }

  public pixelToPlane(pixelPos: Vec2<number>): Vec2<T> {
    return this.rect.pixelToPlane(pixelPos);
  }
}
