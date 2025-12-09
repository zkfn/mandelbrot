/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import { helloFromCommon } from "@mandelbrot/common";
import App from "./App.tsx";

console.log(helloFromCommon());

const root = document.getElementById("root");

render(() => <App />, root!);
