import type { Calc, RectPoints, Vec2 } from "../numeric";
import type { PlaneBounds } from "./limits";
import { MAX_ZOOM2EXP, POSITION_CLAMP_EPSILON } from "./limits";
import type { Viewport } from "./Viewport";

export class ViewportController<T> {
  private calc: Calc<T>;
  private viewport: Viewport<T>;
  private planeBounds: PlaneBounds | null = null;
  private minZoom2Exp: number | null = null;

  public constructor(calc: Calc<T>, rect: Viewport<T>) {
    this.calc = calc;
    this.viewport = rect;
  }

  public setBounds(bounds: PlaneBounds): void {
    this.planeBounds = bounds;
    this.updateMinZoom();
    this.clampZoom();
    this.clampPosition();
  }

  public resetToInitialView(): void {
    if (this.minZoom2Exp !== null) {
      this.viewport.zoom2Exp = this.minZoom2Exp;
    }
    if (this.planeBounds) {
      this.viewport.center = {
        x: this.fromNumber((this.planeBounds.minX + this.planeBounds.maxX) / 2),
        y: this.fromNumber((this.planeBounds.minY + this.planeBounds.maxY) / 2),
      };
    }
    this.clampPosition();
  }

  public getZoomLevel(): number {
    if (this.minZoom2Exp === null) {
      return 1;
    }
    return 2 ** (this.viewport.zoom2Exp - this.minZoom2Exp);
  }

  public getZoomExponent(): number {
    if (this.minZoom2Exp === null) {
      return 0;
    }
    return this.viewport.zoom2Exp - this.minZoom2Exp;
  }

  public moveByPixels({ x: offsetX, y: offsetY }: Vec2<number>) {
    const upp = this.viewport.getUnitsPerPixel();

    this.moveByUnits({
      x: this.calc.multNum(offsetX, upp),
      y: this.calc.multNum(-offsetY, upp),
    });
  }

  public moveByUnits(offset: Vec2<T>) {
    const { x: offX, y: offY } = offset;
    const { x, y } = this.viewport.center;

    this.viewport.center = {
      x: this.calc.add(x, offX),
      y: this.calc.add(y, offY),
    };

    this.clampPosition();
  }

  public resize(width: number, height: number): void {
    this.viewport.pixelSize.width = width;
    this.viewport.pixelSize.height = height;
    this.updateMinZoom();
    this.clampZoom();
    this.clampPosition();
  }

  public zoomByAtPixels(deltaZoom2Exp: number, focusPointPx: Vec2<number>) {
    const uppBefore = this.viewport.getUnitsPerPixel();

    const centerOffsetPx = {
      x: focusPointPx.x - this.viewport.pixelSize.width / 2,
      y: -(focusPointPx.y - this.viewport.pixelSize.height / 2),
    };

    const focusPointPlane = {
      x: this.calc.add(this.calc.multNum(centerOffsetPx.x, uppBefore), this.viewport.center.x),
      y: this.calc.add(this.calc.multNum(centerOffsetPx.y, uppBefore), this.viewport.center.y),
    };

    const newZoom2Exp = this.viewport.zoom2Exp - deltaZoom2Exp;
    let clampedZoom =
      this.minZoom2Exp !== null ? Math.max(newZoom2Exp, this.minZoom2Exp) : newZoom2Exp;
    clampedZoom = Math.min(clampedZoom, MAX_ZOOM2EXP);
    const uppAfter = this.calc.inv2Exp(clampedZoom);

    const centerOffsetPlaneAfter = {
      x: this.calc.multNum(centerOffsetPx.x, uppAfter),
      y: this.calc.multNum(centerOffsetPx.y, uppAfter),
    };

    this.viewport.zoom2Exp = clampedZoom;
    this.viewport.center = {
      x: this.calc.sub(focusPointPlane.x, centerOffsetPlaneAfter.x),
      y: this.calc.sub(focusPointPlane.y, centerOffsetPlaneAfter.y),
    };

    this.clampPosition();
  }

  public pixelToPlane(pixelPos: Vec2<number>): Vec2<T> {
    return this.viewport.pixelToPlane(pixelPos);
  }

  public getBounds(): RectPoints<T> {
    return this.viewport.getBounds();
  }

  private updateMinZoom(): void {
    if (!this.planeBounds) {
      this.minZoom2Exp = null;
      return;
    }

    const { width, height } = this.viewport.pixelSize;
    if (width === 0 || height === 0) {
      this.minZoom2Exp = null;
      return;
    }

    const planeWidth = this.planeBounds.maxX - this.planeBounds.minX;
    const planeHeight = this.planeBounds.maxY - this.planeBounds.minY;

    const zoomForWidth = Math.log2(width / planeWidth);
    const zoomForHeight = Math.log2(height / planeHeight);

    this.minZoom2Exp = Math.min(zoomForWidth, zoomForHeight);
  }

  private clampZoom(): void {
    if (this.minZoom2Exp !== null && this.viewport.zoom2Exp < this.minZoom2Exp) {
      this.viewport.zoom2Exp = this.minZoom2Exp;
    }
    if (this.viewport.zoom2Exp > MAX_ZOOM2EXP) {
      this.viewport.zoom2Exp = MAX_ZOOM2EXP;
    }
  }

  private clampPosition(): void {
    if (!this.planeBounds) return;

    const viewBounds = this.viewport.getBounds();
    const viewMinX = this.toNumber(viewBounds.topleft.x);
    const viewMaxX = this.toNumber(viewBounds.bottomright.x);
    const viewMinY = this.toNumber(viewBounds.bottomright.y);
    const viewMaxY = this.toNumber(viewBounds.topleft.y);

    const viewWidth = viewMaxX - viewMinX;
    const viewHeight = viewMaxY - viewMinY;
    const planeWidth = this.planeBounds.maxX - this.planeBounds.minX;
    const planeHeight = this.planeBounds.maxY - this.planeBounds.minY;

    let newMinX = viewMinX;
    let newMinY = viewMinY;

    if (viewWidth >= planeWidth) {
      const halfOverreach = (viewWidth - planeWidth) / 2;
      newMinX = this.planeBounds.minX - halfOverreach;
    } else {
      const maxMinX = this.planeBounds.maxX - viewWidth;
      if (newMinX < this.planeBounds.minX) newMinX = this.planeBounds.minX;
      if (newMinX > maxMinX) newMinX = maxMinX;
    }

    if (viewHeight >= planeHeight) {
      const halfOverreach = (viewHeight - planeHeight) / 2;
      newMinY = this.planeBounds.minY - halfOverreach;
    } else {
      const maxMinY = this.planeBounds.maxY - viewHeight;
      if (newMinY < this.planeBounds.minY) newMinY = this.planeBounds.minY;
      if (newMinY > maxMinY) newMinY = maxMinY;
    }

    const dx = newMinX - viewMinX;
    const dy = newMinY - viewMinY;

    if (Math.abs(dx) > POSITION_CLAMP_EPSILON || Math.abs(dy) > POSITION_CLAMP_EPSILON) {
      this.viewport.center = {
        x: this.calc.add(this.viewport.center.x, this.fromNumber(dx)),
        y: this.calc.add(this.viewport.center.y, this.fromNumber(dy)),
      };
    }
  }

  private toNumber(value: T): number {
    return this.calc.sub(value, this.calc.zero()) as unknown as number;
  }

  private fromNumber(value: number): T {
    return this.calc.add(this.calc.zero(), value as unknown as T);
  }
}
