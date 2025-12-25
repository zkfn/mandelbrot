import { Assignee } from "../Assignee";

function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

new Assignee(async (data: number) => {
  return fib(data);
});
