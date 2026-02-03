import { Show } from "solid-js";

export type TooltipState = {
  x: number;
  y: number;
  planeX: number;
  planeY: number;
  visible: boolean;
  containerWidth: number;
  containerHeight: number;
};

export const CoordinateTooltip = (props: TooltipState) => {
  const offset = 16;
  const flipThreshold = 4 / 5;

  const flipX = () => props.x > props.containerWidth * flipThreshold;
  const flipY = () => props.y > props.containerHeight * flipThreshold;

  const translateX = () => (flipX() ? `calc(-100% - ${offset}px)` : `${offset}px`);
  const translateY = () => (flipY() ? `calc(-100% - ${offset}px)` : `${offset}px`);

  return (
    <Show when={props.visible}>
      <div
        class="coordinate-tooltip"
        style={{
          left: `${props.x}px`,
          top: `${props.y}px`,
          transform: `translate(${translateX()}, ${translateY()})`,
        }}
      >
        x: {props.planeX.toFixed(6)}
        {"\n"}
        y: {props.planeY.toFixed(6)}
      </div>
    </Show>
  );
};
