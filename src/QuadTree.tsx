import type { Bounds } from "./bounds";

enum QuadTreeState {
	NotLoaded = 0,
	Loading = 1,
	Loaded = 2,
}

class QuadTreeNode {
	parent: QuadTreeNode | null;

	childTL: QuadTreeNode | null;
	childTR: QuadTreeNode | null;
	childBL: QuadTreeNode | null;
	childBR: QuadTreeNode | null;

	bounds: Bounds;
	centerPoint: [number, number];
	state: QuadTreeState;

	constructor(bounds: Bounds, parent: QuadTreeNode | null = null) {
		this.state = QuadTreeState.NotLoaded;
		this.parent = parent;

		this.bounds = { ...bounds };
		this.centerPoint = [
			bounds.maxX - bounds.minX / 2,
			bounds.maxY - bounds.minY / 2,
		];

		this.childTL = null;
		this.childTR = null;
		this.childBL = null;
		this.childBR = null;
	}

	isWithinBounds(outerBounds: Bounds) {
		return !(
			outerBounds.minX > this.bounds.maxX ||
			outerBounds.maxX < this.bounds.minX ||
			outerBounds.minY > this.bounds.maxY ||
			outerBounds.maxY < this.bounds.minY
		);
	}
}

class QuadTree {
	private head: QuadTreeNode;

	public constructor(bounds: Bounds) {
		this.head = new QuadTreeNode(bounds);
	}

	public findFringeOnly(bounds: Bounds, depth: number) {}

	private dfsFringe(
		head: QuadTreeNode,
		bounds: Bounds,
		depth: number,
		result: QuadTreeNode[],
	) {
		if (!head.isWithinBounds(bounds)) {
			return;
		}

		if (depth == 0) {
			result.push(head);
			return;
		}

        else
	}
}
