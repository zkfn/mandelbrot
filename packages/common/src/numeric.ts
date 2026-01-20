export interface Calc<T> {
  add(a: T, b: T): T;
  sub(a: T, b: T): T;
  mult(a: T, b: T): T;
  multNum(a: T, num: number): T;
  inv2Exp(exp: number): T;
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
};
