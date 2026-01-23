export type Vec2<T = number> = {
  x: T;
  y: T;
};

export type RectPoints<T = number> = {
  topleft: Vec2<T>;
  bottomright: Vec2<T>;
};

export type RectWH<T> = {
  width: T;
  height: T;
};

export const rectPointsToWHFactory =
  <T>(calc: Calc<T>) =>
  ({ topleft, bottomright }: RectPoints<T>): RectWH<T> => {
    return {
      width: calc.sub(bottomright.x, topleft.x),
      height: calc.sub(bottomright.y, topleft.y),
    };
  };

export interface Calc<T> {
  add(a: T, b: T): T;
  sub(a: T, b: T): T;
  mult(a: T, b: T): T;
  multNum(num: number, value: T): T;
  inv2Exp(exp: number): T;
  mult2ExpShouldBeInt(exp: number, value: T): number;
  zeroAlignedSteps(step: T, min: T, max: T): T[];
  zero(): T;
  copy(val: T): T;
}

export const NumberCalc: Calc<number> = {
  add(a: number, b: number): number {
    return a + b;
  },

  sub(a: number, b: number): number {
    return a - b;
  },

  mult(a: number, b: number): number {
    return a * b;
  },

  multNum(a: number, num: number): number {
    return a * num;
  },

  inv2Exp(exp: number): number {
    return 1 / 2 ** exp;
  },

  zero(): number {
    return 0;
  },

  copy(val: number): number {
    return val;
  },

  mult2ExpShouldBeInt(exp: number, value: number): number {
    return Math.round(value * 2 ** exp);
  },

  zeroAlignedSteps(step: number, min: number, max: number) {
    const firstStep = Math.ceil(min / step) * step;
    const steps: number[] = [];

    for (let x = firstStep; x < max; x += step) {
      steps.push(x);
    }

    return steps;
  },
};
