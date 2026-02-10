export interface PlaneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const MANDELBROT_BOUNDS: PlaneBounds = {
  minX: -2.5,
  maxX: 1.0,
  minY: -1.5,
  maxY: 1.5,
};

export const DOUBLE_MANTISSA_BITS = 53;
export const PLANE_COORD_MAX_MAGNITUDE = 2.5;
export const PLANE_COORD_INTEGER_BITS = Math.ceil(Math.log2(PLANE_COORD_MAX_MAGNITUDE));

export const MAX_ZOOM2EXP = DOUBLE_MANTISSA_BITS - PLANE_COORD_INTEGER_BITS;

export function zoomLevelsUntilPrecisionLimit(minZoom2Exp: number): number {
  return Math.floor(MAX_ZOOM2EXP - minZoom2Exp);
}

export const POSITION_CLAMP_EPSILON = 1e-10;
