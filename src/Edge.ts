import { SplayItem } from './SplayItem';
import { MonotoneRegion } from './MonotoneRegion'
import { perpDotSign, epsilon } from './orient';

type f64 = number;
type u32 = number;

export interface Point {
	x: f64;
	y: f64;
}

/** Homogeneous 2D coordinates, for representing line segment intersection points using rational numbers.
  * Contains error bounds from inexact intersection point calculation. */

export interface RationalPoint extends Point {
	/** Divisor component in 2D homogeneous coordinates. */
	w: f64;
	/** Magnitude of X coordinate error. */
	xErr: f64;
	/** Magnitude of Y coordinate error. */
	yErr: f64;
	/** Magnitude of W coordinate error. */
	wErr: f64;

	/** First set of collinear edges intersecting at this point. */
	a: EdgeBundle | null;
	/** Second set of collinear edges intersecting at this point. */
	b: EdgeBundle | null;

	/** Exact X coordinate, list of multiple floats with different exponents to sum together. */
	xExact: f64[] | null;
	/** Number of components in exact X coordinate. */
	xExactLen: u32;
	/** Exact Y coordinate, list of multiple floats with different exponents to sum together. */
	yExact: f64[] | null;
	/** Number of components in exact Y coordinate. */
	yExactLen: u32;
	/** Exact W coordinate, list of multiple floats with different exponents to sum together. */
	wExact: f64[] | null;
	/** Number of components in exact W coordinate. */
	wExactLen: u32;

	/** Flag whether intersection has been reported in algorithm output. */
	reported: boolean;
}

export interface Line extends Point {
	x2: f64;
	y2: f64;
}

export interface Ref {
	ring: Ring;
	pos: number;
}

export interface PointRef extends Point, Ref { }

/** Polygon ring, list of points defining an implicitly closed polyline. */

export type Ring = Point[];

/** Line segment forming a polygon edge. */

export class Edge implements Line, Ref {

	constructor(
		public ring: Ring,
		/** Index of line segment start point along ring. */
		public pos: u32,
		/** Index of line segment end point along ring. */
		public pos2: u32,
		/** Direction of line segment in ring.
		  * 1 if pos < pos2 and
		  * -1 if pos > pos2
		  * unless the segment connects ring endpoints.
		  * Note that indices may not be consecutive because duplicate points are skipped. */
		public dir: -1 | 1
	) {
		let x = ring[pos].x;
		let y = ring[pos].y;
		let x2 = ring[pos2].x;
		let y2 = ring[pos2].y;

		// Ensure line points down or horizontally to the right.
		if(y > y2 || (y == y2 && x > x2)) {
			x2 = ring[pos].x;
			y2 = ring[pos].y;
			x = ring[pos2].x;
			y = ring[pos2].y;
		}

		this.x = x;
		this.y = y;
		this.x2 = x2;
		this.y2 = y2;
	}

	/** Return sign of angle between this edge and another line.
	  * This function only gets called in situations where key is a bundle or edge that touches this edge. */

	angleDeltaFrom(key: Line): f64 {
		return perpDotSign(this.x, this.y, this.x2, this.y2, key.x, key.y, key.x2, key.y2);
	}

	x: number;
	y: number;
	x2: number;
	y2: number;

	/** Set containing all edges collinear with this one. */
	bundle: EdgeBundle | null = null;

}

/** Splay tree node containing a collection of collinear edges. */

export class EdgeNode extends SplayItem<Line> {

	constructor(public bundle: EdgeBundle) {
		super();
		bundle.node = this;
	}

	static create(key: Line): EdgeNode {
		const node = (EdgeNode.firstFree || new EdgeNode(new EdgeBundle())) as EdgeNode;
		EdgeNode.firstFree = node.nextFree;

		node.bundle.assign(key);

		return node;
	}

	free(): void {
		this.reset();
		this.bundle.reset();

		this.nextFree = EdgeNode.firstFree;
		EdgeNode.firstFree = this;
	}

	deltaFrom(key: Line): f64 {
		return this.bundle.deltaFrom(key);
	}

	private static firstFree: EdgeNode | null = null;
	nextFree: EdgeNode | null = null;

}

/** Collection of collinear edges. */

export class EdgeBundle implements Line {

	constructor() {
		++EdgeBundle.allocated;
		this.id = ++EdgeBundle.idLatest;
	}

	assign(key: Line): void {
		const x = key.x;

		this.x = x;
		this.y = key.y;

		this.xErr = (x < 0 ? -x : x) * epsilon;

		this.updateBounds(key.x2, key.y2);
	}

	updateBounds(x2: f64, y2: f64): void {
		let adx = x2 - this.x;

		this.x2 = x2;
		this.y2 = y2;

		if(adx < 0) adx = -adx;

		// Add epsilon to final result accounting for manipulations here and
		// later in checkIntersection.
		this.adx = adx * (1 + epsilon * 2);
	}

	reset(): void {
		if(this.count) {
			this.lines.clear();
			this.count = 0;
		}
		this.region = null;
	}

	insert(key: Edge): void {
		if(!this.lines.has(key)) {
			++this.count;
			this.lines.add(key);
			key.bundle = this;

			const x2 = key.x2;
			const y2 = key.y2;

			if(y2 > this.y2 || (y2 == this.y2 && x2 > this.x2)) {
				this.updateBounds(x2, y2);
			}
		}
	}

	remove(key: Edge): void {
		--this.count;
		this.lines.delete(key);
		key.bundle = null;
	}

	deltaFrom(key: Line): f64 {
		return perpDotSign(this.x, this.y, this.x2, this.y2, this.x, this.y, key.x, key.y);
	}

	node!: EdgeNode;

	static allocated: u32 = 0;
	static idLatest: u32 = 0;
	id: u32;

	x: number;
	y: number;
	x2: number;
	y2: number;

	xErr: f64;
	adx: f64;

	count: u32 = 0;
	lines: Set<Edge> = new Set<Edge>();

	seen: boolean = false;

	afterIsInside: boolean = false;
	region: MonotoneRegion | null = null;

}
