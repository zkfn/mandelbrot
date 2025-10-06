import type Camera from "./camera";

export class GridEventHandler {
	private readonly zoomFactor = 0.001;

	private camera: Camera;

	private wrapper: HTMLDivElement;
	private canvas: HTMLCanvasElement;

	private dprQuery: MediaQueryList | null;
	private resizeObserver: ResizeObserver;

	private pointers = new Map<number, { x: number; y: number }>();
	private lastPinchDist = 0;

	public constructor(
		camera: Camera,
		canvas: HTMLCanvasElement,
		wrapper: HTMLDivElement,
	) {
		this.camera = camera;
		this.canvas = canvas;
		this.wrapper = wrapper;
		this.dprQuery = null;

		this.resizeObserver = new ResizeObserver(this.updateCanvasDimensions);
		this.resizeObserver.observe(wrapper);
		this.canvas.style.touchAction = "none";

		canvas.addEventListener("pointerdown", this.handlePointerDown);
		canvas.addEventListener("pointermove", this.handlePointerMove, {
			passive: false,
		});
		canvas.addEventListener("pointerup", this.handlePointerUp);
		canvas.addEventListener("pointercancel", this.handlePointerUp);
		canvas.addEventListener("lostpointercapture", this.handlePointerUp);

		canvas.addEventListener("wheel", this.handleWheel, { passive: false });
		window.addEventListener("resize", this.updateCanvasDimensions);

		this.updateCanvasDimensions();
		this.hookOntoDPR();
		this.setDefaultPointerStyle();
	}

	public deattach() {
		this.canvas.removeEventListener("wheel", this.handleWheel);

		this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
		this.canvas.removeEventListener("pointermove", this.handlePointerMove);

		this.canvas.removeEventListener("pointerup", this.handlePointerUp);
		this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
		this.canvas.removeEventListener("lostpointercapture", this.handlePointerUp);

		window.removeEventListener("resize", this.updateCanvasDimensions);

		this.resizeObserver.unobserve(this.wrapper);
		this.resizeObserver.disconnect();

		this.unhookFromDPR();

		this.dprQuery = null;
	}

	private hookOntoDPR = () => {
		this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
		this.dprQuery.addEventListener("change", this.updateAndRehook, {
			once: true,
		});
	};

	private unhookFromDPR = () => {
		this.dprQuery?.removeEventListener("change", this.updateAndRehook);
		this.dprQuery = null;
	};

	private updateAndRehook = () => {
		this.updateCanvasDimensions();
		this.hookOntoDPR();
	};

	private updateCanvasDimensions = () => {
		const bounding = this.wrapper.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		this.canvas.width = Math.round(bounding.width * dpr);
		this.canvas.height = Math.round(bounding.height * dpr);

		this.camera.adaptToDPR(dpr);
		this.camera.adaptToCanvas(this.canvas);
	};

	private handlePointerDown = (event: PointerEvent) => {
		this.canvas.setPointerCapture(event.pointerId);
		event.preventDefault();

		this.pointers.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
		});

		if (this.pointers.size === 1) this.setGrabbingPointerStyle();
		if (this.pointers.size === 2) {
			this.lastPinchDist = this.currentPinchDist();
		}
	};

	private handlePointerMove = (event: PointerEvent) => {
		event.preventDefault();

		if (!this.pointers.has(event.pointerId)) return;

		if (this.pointers.size === 1) {
			const prev = this.pointers.get(event.pointerId)!;

			this.pointers.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});

			const [x0, y0] = this.camera.clientCoordToCamera(prev.x, prev.y);
			const [cx, cy] = this.camera.clientCoordToCamera(
				event.clientX,
				event.clientY,
			);

			const dx = x0 - cx;
			const dy = y0 - cy;

			this.camera.moveViewportByCameraPx(dx, dy);
			return;
		}

		if (this.pointers.size === 2) {
			const dist = this.currentPinchDist();

			if (this.lastPinchDist > 0) {
				const factor = dist / this.lastPinchDist;
				const { x: mx, y: my } = this.currentMidpoint();
				const [mcx, mcy] = this.camera.clientCoordToCamera(mx, my);
				const upp = this.camera.getUPP() / factor;
				this.camera.zoomViewportAtCameraPx(upp, mcx, mcy);
			}

			this.lastPinchDist = dist;

			for (const id of this.pointers.keys()) {
				if (id === event.pointerId) {
					this.pointers.set(id, {
						x: event.clientX,
						y: event.clientY,
					});
				}
			}
		}
	};

	private handlePointerUp = (event: PointerEvent) => {
		this.pointers.delete(event.pointerId);
		if (this.pointers.size <= 1) this.lastPinchDist = 0;
		if (this.pointers.size === 0) this.setDefaultPointerStyle();
	};

	private handleWheel = (event: WheelEvent) => {
		event.preventDefault();

		const factor = 2 ** (this.zoomFactor * event.deltaY);
		const [cameraX, cameraY] = this.camera.clientCoordToCamera(
			event.clientX,
			event.clientY,
		);

		this.camera.zoomViewportAtCameraPx(
			this.camera.getUPP() * factor,
			cameraX,
			cameraY,
		);
	};

	private currentPinchDist() {
		const [a, b] = Array.from(this.pointers.values());
		if (!a || !b) return 0;
		const dx = a.x - b.x; // FIX: don’t use b.cy
		const dy = a.y - b.y;
		return Math.hypot(dx, dy);
	}

	private currentMidpoint() {
		const [a, b] = Array.from(this.pointers.values());
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	private setDefaultPointerStyle() {
		this.canvas.style.cursor = "crosshair";
	}

	private setGrabbingPointerStyle() {
		this.canvas.style.cursor = "grabbing";
	}
}
