// TODO move into app package
import { range } from "@mandelbrot/common/utils";

const MIN_EXPO = 5;
const MAX_EXPO = 10;

export const resolutionValues = range(MIN_EXPO, MAX_EXPO).map((e) => 2 ** e);
