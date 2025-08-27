import type { Bounds, Plane, Rect } from "@common/types";
import { boundsToRect, clamp, planeToBounds, rect } from "@common/utils";
import { Viewport } from "@lib/viewport";

export class Camera {
	private planeSide: number;
	private cameraRect: Rect;
	private DPR: number;

	private curUPP: number;
	private maxUPP: number;
	private readonly minUPP: number;
	private readonly viewport: Viewport;

	public constructor(plane: Plane) {
		this.viewport = new Viewport(plane);
		this.planeSide = plane.side;
		this.cameraRect = boundsToRect(planeToBounds(plane));
		this.minUPP = 2 ** -58;
		this.maxUPP = 1;
		this.curUPP = 1;
		this.DPR = 1;
	}

	public getUPP() {
		return this.curUPP;
	}

	public setUPP(upp: number) {
		this.curUPP = upp;
		this.ensureClampedUPP();
	}

	public clampedUPP(upp: number) {
		return clamp(this.minUPP, upp, this.maxUPP);
	}

	public adaptToCanvas(canvas: HTMLCanvasElement) {
		this.cameraRect = rect(canvas);

		const horizontalPPU = this.planeSide / this.cameraRect.width;
		const verticalPPU = this.planeSide / this.cameraRect.height;

		this.maxUPP = Math.max(horizontalPPU, verticalPPU);

		this.ensureClampedUPP();
		this.resizeViewport();
	}

	public moveViewportByCameraPx(dx: number, dy: number) {
		this.viewport.moveBy(dx * this.curUPP, dy * this.curUPP);
	}

	public zoomViewportAtCameraPx(upp: number, x: number, y: number) {
		const center = this.cameraCoordToPlane(x, y);
		this.setUPP(upp);
		this.resizeViewport(center);
	}

	public adaptToDPR(dpr: number) {
		this.DPR = dpr;
	}

	public optimalDepthLevelPerResolution(texelResolution: number): number {
		return Math.ceil(
			Math.log2(this.planeSide / (this.curUPP * texelResolution)),
		);
	}

	public clientCoordToCamera(clX: number, clY: number): [number, number] {
		const { top, left } = this.cameraRect;
		return [(clX - left) * this.DPR, (clY - top) * this.DPR];
	}

	public cameraCoordToPlane(x: number, y: number): [number, number] {
		return [this.cameraXToPlane(x), this.cameraYToPlane(y)];
	}

	public cameraXToPlane(x: number): number {
		return this.viewport.minX() + x * this.curUPP;
	}

	public cameraYToPlane(y: number): number {
		return this.viewport.minY() + y * this.curUPP;
	}

	public planeBoundsToCamera(bounds: Bounds): Bounds {
		const [minX, minY] = this.planeCoordToCamera(bounds.minX, bounds.minY);
		const [maxX, maxY] = this.planeCoordToCamera(bounds.maxX, bounds.maxY);
		return {
			minX,
			minY,
			maxX,
			maxY,
		};
	}

	public planeCoordToCamera(x: number, y: number): [number, number] {
		return [this.planeXToCamera(x), this.planeYToCamera(y)];
	}

	public planeXToCamera(x: number): number {
		return (x - this.viewport.minX()) / this.curUPP;
	}

	public planeYToCamera(y: number): number {
		return (y - this.viewport.minY()) / this.curUPP;
	}

	public viewportBounds(): Bounds {
		return this.viewport.bounds();
	}

	private ensureClampedUPP() {
		this.curUPP = this.clampedUPP(this.curUPP);
	}

	private resizeViewport(center?: [number, number]) {
		this.viewport.resize(
			this.cameraRect.width * this.curUPP,
			this.cameraRect.height * this.curUPP,
			center,
		);
	}
}
