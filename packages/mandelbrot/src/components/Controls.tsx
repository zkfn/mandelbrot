import type { Accessor, Setter } from "solid-js";

export type ControlsState = {
  showTooltip: boolean;
  showLabels: boolean;
  showGridlines: boolean;
};

type ControlsProps = {
  state: Accessor<ControlsState>;
  setState: Setter<ControlsState>;
  zoomExponent: Accessor<number>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onDisplayChange?: () => void;
};

const Controls = (props: ControlsProps) => {
  const toggle = (key: keyof ControlsState) => {
    props.setState((prev) => ({ ...prev, [key]: !prev[key] }));

    if (key !== "showTooltip") {
      props.onDisplayChange?.();
    }
  };

  const zoomDisplay = (): string => {
    const exponent = props.zoomExponent();
    if (exponent <= 8) {
      return String(Math.round(2 ** exponent));
    } else {
      return `2^${Math.round(exponent)}`;
    }
  };

  return (
    <div class="controls-panel">
      <div class="controls-group">
        <button type="button" onClick={props.onZoomIn}>
          +
        </button>
        <button type="button" onClick={props.onZoomOut}>
          -
        </button>
        <button type="button" onClick={props.onReset}>
          Reset
        </button>
        <span class="zoom-level">Zoom: {zoomDisplay()}x</span>
      </div>

      <div class="controls-group">
        <label>
          <input
            type="checkbox"
            checked={props.state().showGridlines}
            onChange={() => toggle("showGridlines")}
          />
          Gridlines
        </label>
        <label>
          <input
            type="checkbox"
            checked={props.state().showLabels}
            onChange={() => toggle("showLabels")}
          />
          Labels
        </label>
        <label>
          <input
            type="checkbox"
            checked={props.state().showTooltip}
            onChange={() => toggle("showTooltip")}
          />
          Tooltip
        </label>
      </div>
    </div>
  );
};

export default Controls;
