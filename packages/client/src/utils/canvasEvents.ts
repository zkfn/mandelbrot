export const createCanvasEvents = (wrapper: HTMLDivElement, callback: () => unknown) => {
  let dprQuery: MediaQueryList | undefined;
  const observer = new ResizeObserver(callback);

  const updateDPRAndRehook = () => {
    hookOntoDPR();
  };

  const hookOntoDPR = () => {
    dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprQuery.addEventListener("change", updateDPRAndRehook, { once: true });
  };

  const unhookFromDPR = () => {
    dprQuery?.removeEventListener("change", updateDPRAndRehook);
    dprQuery = undefined;
  };

  observer.observe(wrapper);
  hookOntoDPR();

  return () => {
    unhookFromDPR();
    observer.unobserve(wrapper);
  };
};
