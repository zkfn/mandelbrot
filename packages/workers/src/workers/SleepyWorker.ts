import { sleep } from "@mandelbrot/common/utils";
import { Assignee } from "../Assignee";

new Assignee(async (data: number) => {
  await sleep(data);
  return data;
});
