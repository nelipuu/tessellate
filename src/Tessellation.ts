import { SplayTree } from './SplayTree';
import { Point, Line, PointRef, RationalPoint, Ring, Edge, EdgeBundle, EdgeNode } from './Edge';
import { Vertex, MonotoneRegion } from './MonotoneRegion';
import { IntersectionPoint, SweepEvent } from './SweepEvent';
import { epsilon, perpErrBound1, perpDotSign } from './orient';

type f64 = number;
type i32 = number;
type u32 = number;

export type Polygon = Ring[];

export const crossings: RationalPoint[] = [];

const intersection: IntersectionPoint = {
	x: 0,
	y: 0,
	w: 1,
	xErr: 0,
	yErr: 0,
	wErr: 0,
	a: null,
	b: null,
	xExact: null,
	xExactLen: 0,
	yExact: null,
	yExactLen: 0,
	wExact: null,
	wExactLen: 0,
	reported: false
};

/** Maximum coordinate range for use in sentinels. */
let limit: f64;
for(let next: f64 = (~0 as u32) >>> 0; next < next * 2; next = (next - 1) * (next + 1)) limit = next;

const abs = Math.abs;

function checkIntersection(a: EdgeBundle, b: EdgeBundle): RationalPoint | null {
	const delta = (a.x + a.x2) - (b.x + b.x2);
	// 2 ulps of epsilon to account for the addition and actual multiplication
	// by an error term. Contribution of the above (x + x2) terms have been taken
	// into account previously while computing adx.
	const size = (a.adx + b.adx) * (1 + epsilon * 2) + (a.xErr + b.xErr) * 2;

	// Fast pretest: check non-overlapping bounding box x coordinates
	// to discard obviously nonintersecting lines.
	if(size < delta || size < -delta) return null;

	const det = perpDotSign(a.x, a.y, a.x2, a.y2, b.x, b.y, b.x2, b.y2);

	// Stop if the intersection is on or above the sweep line. Works because
	// line segments are oriented downwards and sorted along the sweep line.
	if(det <= 0) return null;

	intersection.a = a;
	intersection.b = b;

	// Check that segment A intersects before it ends.
	const a2 = perpDotSign(a.x2, a.y2, b.x, b.y, a.x2, a.y2, b.x2, b.y2);
	if(a2 > 0) return null;

	// Check that segment B intersects before it ends.
	const b2 = perpDotSign(b.x2, b.y2, a.x, a.y, b.x2, b.y2, a.x2, a.y2);
	if(b2 < 0) return null;

	if(a2 * b2 == 0) {
		// Exact result, intersection is at an endpoint.
		// We must detect lines touching end vertex events, because handling
		// an end vertex doesn't query the sweep line structure whose
		// state gets corrupted if the touching line is ignored.

		if(a2 == 0) {
			intersection.a = null;
			intersection.x = a.x2;
			intersection.y = a.y2;
			intersection.w = 0;
		} else {
			intersection.b = null;
			intersection.x = b.x2;
			intersection.y = b.y2;
			intersection.w = 0;
		}

		return intersection;
	}

	// Approximate result.
	const detLeft = (a.x2 - a.x) * (b.y2 - b.y);
	const detRight = (a.y2 - a.y) * (b.x2 - b.x);
	const detErr = abs(det) * epsilon + (abs(detLeft) + abs(detRight)) * perpErrBound1;

	const a2Left = (b.x - a.x2) * (b.y2 - a.y2);
	const a2Right = (b.y - a.y2) * (b.x2 - a.x2);
	const a2Err = abs(a2) * epsilon + (abs(a2Left) + abs(a2Right)) * perpErrBound1;

	intersection.x = a.x2 * det + (a.x2 - a.x) * a2;
	intersection.y = a.y2 * det + (a.y2 - a.y) * a2;
	intersection.w = det;
	intersection.xErr = (
		abs(a.x2) * detErr +
		abs(a.x2 - a.x) * a2Err
	) * (1 + epsilon * 2);
	intersection.yErr = (
		abs(a.y2) * detErr +
		abs(a.y2 - a.y) * a2Err
	) * (1 + epsilon * 2);
	intersection.wErr = detErr;

	intersection.xExact = null;
	intersection.yExact = null;
	intersection.wExact = null;

	return intersection;
}

/** Merge edges into bundles.
  * Bundles are already in the sweep line tree structure.
  * Extract them into a list and insert new edges maintaining correct ordering.
  * Edges can be inserted into existing or new bundles.
  * The sync function can then write the new and updated bundles back in the sweep line tree. */

function mergeEdgesIntoNodes(nodes: EdgeNode[], edges: Edge[], edgeNum: u32): EdgeBundle[] {
	const bundles: EdgeBundle[] = [];
	const edgeCount: u32 = edges.length;
	// Iterate existing nodes in reverse order of edges intersecting at this point.
	let nodeNum = nodes.length;

	let edge: Edge | null = edgeNum < edgeCount ? edges[edgeNum] : null;
	let bundle: EdgeBundle | null;
	let delta: i32 = 0;

	do {
		bundle = nodeNum-- ? nodes[nodeNum].bundle : null;
	} while(!!bundle && !bundle.count);

	while(1) {
		if(!edge) {
			if(!bundle) break;

			delta = -1;
		} else if(!bundle) {
			delta = 1;
		} else {
			delta = -edge.angleDeltaFrom(bundle);
		}

		if(delta < 0) {
			bundles.push(bundle as EdgeBundle);

			if(nodeNum < 0) {
				bundle = null;
			} else if(bundle == nodes[nodeNum].bundle) {
				do {
					bundle = nodeNum-- ? nodes[nodeNum].bundle : null;
				} while(!!bundle && !bundle.count);
			} else {
				bundle = nodes[nodeNum].bundle;
			}
		} else {
			if(delta > 0) {
				bundle = new EdgeBundle();
				bundle.assign(edge!);
			}

			(bundle as EdgeBundle).insert(edge!);

			if(++edgeNum >= edgeCount) {
				edge = null;
				continue;
			}

			edge = edges[edgeNum];
		}
	}

	if(bundle) bundles.push(bundle);

	return bundles;
}

function findPreviousRegion(node: EdgeNode | null): MonotoneRegion | null {
	do {
		node = node!.prev as (EdgeNode | null);
	} while(!!node && !(node.bundle.count & 1));

	return node ? node.bundle.region : null;
}

function findNextRegion(node: EdgeNode | null): MonotoneRegion | null {
	do {
		node = node!.next as (EdgeNode | null);
	} while(!!node && !(node.bundle.count & 1));

	return node ? node.bundle.region : null;
}

function computeStartPoints(polygon: Polygon, rings: Ring[] = []): PointRef[] {
	const startPoints: PointRef[] = [];

	// Find all topmost points and leftmost points along top edges.
	for(let num: i32 = 0; num < polygon.length; ++num) {
		const ring = polygon[num];
		const count = ring.length;
		if(count < 3) continue;

		let hasEntry = false;
		let first: u32 = 0;
		let maybeEntry = -1;
		let point = ring[count - 1];
		let x = point.x;
		let y = point.y;
		let xEntry: f64 = 0;
		let yEntry: f64 = 0;
		let pos: u32 = 0;

		do {
			const xPrev = x;
			const yPrev = y;
			point = ring[pos];
			x = point.x;
			y = point.y;

			if(y != yPrev || x != xPrev) {
				if(y < yPrev || (y == yPrev && x < xPrev)) {
					if(!first) first = pos;
					maybeEntry = pos;
					xEntry = x;
					yEntry = y;
				} else {
					if(maybeEntry >= 0) {
						if(!first) first = pos;
						hasEntry = true;
						startPoints.push({ x: xEntry, y: yEntry, ring, pos: maybeEntry });
					}
					maybeEntry = -1;
				}
			}

			if(++pos == count) pos = 0;
		} while(pos != first);

		if(hasEntry) rings.push(ring);
	}

	return startPoints.sort(
		(a: PointRef, b: PointRef): i32 => {
			const result = a.y - b.y || a.x - b.x || a.pos - b.pos;
			return (+(result > 0) as i32) - (+(result < 0) as i32);
		}
	);
}

export class Tessellation {

	constructor(polygon: Polygon) {
		this.startPoints = computeStartPoints(polygon, this.rings);

		this.sentinelBefore.bundle.afterIsInside = false;
		this.sentinelAfter.bundle.afterIsInside = true;

		this.updateStart();
	}

	addVertex(
		region: MonotoneRegion,
		point: RationalPoint /* | Vertex */,
		bundle: EdgeBundle,
		isLeft: boolean,
		isMerge: boolean
	): void {
		if(point.w && !point.reported) {
			this.intersectionPoints.push({ x: point.x / point.w, y: point.y / point.w });
			point.reported = true;
		}
		region.addVertex(point, bundle, isLeft, isMerge);
	}

	updateStart(): void {
		const startPoints = this.startPoints;
		const startCount: u32 = startPoints.length;
		let nextStart = this.nextStart;
		let event: SweepEvent | null = null;

		while(nextStart < startCount) {
			const point = startPoints[nextStart];

			if(!event) {
				this.startPoint.x = point.x;
				this.startPoint.y = point.y;
				event = this.eventTree.insert(this.startPoint).node;
			} else if(point.x != event.point.x || point.y != event.point.y) {
				break;
			}

			event.start[event.startCount++] = point;
			++nextStart;
		}

		this.latestStart = event;
		this.nextStart = nextStart;
	}

	/** @param dir -1 or 1 */
	insertBend(ring: Ring, start: u32, end: u32, dir: -1 | 1): Edge {
		const edge = new Edge(ring, start, end, dir);
		this.startPoint.x = edge.x2;
		this.startPoint.y = edge.y2;

		this.eventTree.insert(this.startPoint).node.bend.push(edge);

		return edge;
	}

	updateNeighbors(event: SweepEvent): EdgeNode[] {
		const nodes: EdgeNode[] = [];
		let bundle!: EdgeBundle;

		// Mark all edges crossing at this point.

		for(let num = event.bend.length; num--;) {
			bundle = event.bend[num].bundle!;
			bundle.seen = true;
		}

		for(let num = event.crossCount; num--;) {
			bundle = event.cross[num]!;
			bundle.seen = true;
			event.cross[num] = null;
		}

		// Find neighbor edges along the sweep line, that do not pass this point.
		// They must exist thanks to sentinels at both ends of the sweep line.

		let before = bundle.node.prev as EdgeNode;

		while(before.bundle.seen) {
			before = before.prev as EdgeNode;
		}

		let after = before.next as EdgeNode;

		while(after.bundle.seen) {
			nodes.push(after);
			(after as EdgeNode).bundle.seen = false;

			after = after.next as EdgeNode;
		}

		event.before = before.bundle;
		event.after = after.bundle;

		return nodes;
	}

	/** Handle end, merge and normal vertices.
	  * @param transitionNodes Array to overwrite with a list of nodes with a region transition. */

	updateStatusBefore(event: SweepEvent, transitionNodes: EdgeNode[]): u32 {
		const before = event.before!.node;
		const after = event.after!.node;
		let transitions: u32 = 0;

		for(let node = before.next as EdgeNode; node != after; node = node.next as EdgeNode) {
			if(node.bundle.count & 1) {
				transitionNodes[transitions++] = node;
			}
		}

		if(!transitions) return transitions;

		let regionInside: MonotoneRegion | null = null;
		let bundle = transitionNodes[0].bundle;

		if(!bundle.afterIsInside) {
			regionInside = findPreviousRegion(before.next as EdgeNode)!;

			if(transitions > 1 && regionInside.latestIsMerge) {
				this.addVertex(regionInside, event.point, bundle, false, true);
			}
		}

		let transition: u32 = 0;
		let latestIsMerge: boolean = false;
		let afterIsInside = !before.bundle.afterIsInside;

		while(transition < transitions) {
			const node = transitionNodes[transition++];
			bundle = node.bundle;

			if(bundle.afterIsInside != afterIsInside) {
				// console.log('IMPOSSIBLE?', bundle);
				// this.check(event);
			}

			const region = bundle.region!;
			afterIsInside = bundle.afterIsInside;
			if(afterIsInside) regionInside = region;

			const isMerge = transition < transitions;
			latestIsMerge = regionInside!.latestIsMerge;

			if(latestIsMerge) {
				this.addVertex(region, event.point, bundle, afterIsInside, isMerge);
				region.closed = true;
			} else if(transitions > 1) {
				this.addVertex(regionInside!, event.point, bundle, afterIsInside, isMerge);
			}

			if(transition < transitions) afterIsInside = !afterIsInside;
		}

		if(latestIsMerge && afterIsInside) {
			regionInside = findNextRegion(after.prev as EdgeNode)!;
			bundle.region = regionInside;

			if(transitions > 1) {
				this.addVertex(regionInside, event.point, bundle, true, false);
			}
		}

		// this.check(event);

		return transitions;
	}

	/** Handle start, split and normal vertices.
	  * @param transitionNodes Array to overwrite with a list of nodes with a region transition. */

	updateStatusAfter(
		event: SweepEvent,
		region: MonotoneRegion | null,
		regionAfter: MonotoneRegion | null,
		transitionNodes: EdgeNode[]
	): u32 {
		const before = event.before!.node;
		const after = event.after!.node;
		let afterIsInside = before.bundle.afterIsInside;
		let transitions: u32 = 0;

		for(let node = before.next as EdgeNode; node != after; node = node.next as EdgeNode) {
			const bundle = node.bundle;

			if(bundle.count & 1) {
				afterIsInside = !afterIsInside;
				transitionNodes[transitions++] = node;
			}

			bundle.afterIsInside = afterIsInside;
		}

		let helperVertex: Vertex | null = null;
		let helperBundle: EdgeBundle | null = null;
		let helperIsMerge: boolean = false;
		let transition: u32 = 0;

		while(transition < transitions) {
			const node = transitionNodes[transition++];
			const bundle = node.bundle;
			const afterIsInside = bundle.afterIsInside;

			if(afterIsInside) {
				if(transition == transitions && regionAfter && helperVertex && (helperVertex.isLeft || helperIsMerge)) {
					region = regionAfter;
				} else if(!region || transition > 1) {
					region = new MonotoneRegion();
					this.monotoneRegions.push(region);

					if(helperVertex) {
						this.startPoint.x = helperVertex.x;
						this.startPoint.y = helperVertex.y;
						this.addVertex(region, this.startPoint, helperBundle!, false, false);
					}
				}
			} else if(transition < transitions && region!.latestVertex) {
				helperVertex = region!.latestVertex;
				helperBundle = region!.latestBundle!;
				helperIsMerge = region!.latestIsMerge;

				if(helperVertex!.isLeft) {
					region = new MonotoneRegion();
					this.monotoneRegions.push(region);

					helperBundle.region = region;
					this.startPoint.x = helperVertex!.x;
					this.startPoint.y = helperVertex!.y;
					this.addVertex(region, this.startPoint, helperBundle, false, false);
				}
			}

			this.addVertex(region!, event.point, bundle, afterIsInside, false);
			bundle.region = region;
		}

		if(helperVertex && !helperVertex.isLeft) {
			helperBundle!.region = region;
		}

		// this.check(event);

		return transitions;
	}

	handleConnectedEdges(event: SweepEvent, edges: Edge[]): void {
		// Add downward edges connected to edges that ended at this point.
		for(let num = event.bend.length; num--;) {
			const edge = event.bend[num];
			edge.bundle!.remove(edge);

			const ring = edge.ring;
			const dir = edge.dir;
			let follower = dir < 0 ? edge.pos : edge.pos2;
			let next: Point;

			do {
				if(dir < 0) {
					if(!follower) follower = ring.length;
					--follower;
				} else {
					++follower;
					if(follower == ring.length) follower = 0;
				}
				next = ring[follower];
			} while(next.y == event.point.y && next.x == event.point.x);

			if(next.y > event.point.y || (next.y == event.point.y && next.x > event.point.x)) {
				edges.push(dir < 0 ? this.insertBend(ring, follower, edge.pos, dir) :
					this.insertBend(ring, edge.pos2, follower, dir)
				);
			}
		}
	}

	handleNewEdges(event: SweepEvent, edges: Edge[]): void {
		const count = event.startCount;

		for(let num: u32 = 0; num < count; ++num) {
			const start = event.start[num]!;
			const ring = start.ring;
			const pos = start.pos;
			event.start[num] = null;

			const posPrev = pos ? pos - 1 : ring.length - 1;

			edges.push(this.insertBend(ring, posPrev, pos, -1));

			let posNext = pos;
			let next: Point;

			do {
				++posNext;
				if(posNext == ring.length) posNext = 0;
				next = ring[posNext];
			} while(next.y == event.point.y && next.x == event.point.x);

			edges.push(this.insertBend(ring, pos, posNext, 1));
		}
	}

	/* check(event: SweepEvent): void {
		let errors: string[] = [];
		let a = false;

		if(this.crossTree.first!.next == this.crossTree.last) return;
		let pos: u32 = 0;

		for(
			let bundle = (this.crossTree.first!.next as EdgeNode).bundle;
			bundle != this.crossTree.last!.bundle;
			bundle = (bundle.node.next as EdgeNode).bundle
		) {
			if(bundle.count & 1) a = !a;

			if(bundle.afterIsInside !== a) errors.push('nesting ' + pos);
			if(bundle.seen) errors.push('flag ' + pos);
			++pos;
			if(pos > 10000) {
				// debugger;
				errors.length = 1;
				break;
			}
		}

		if(errors.length) {
			// console.log(this.steps);
			// console.log(errors);
			throw new Error();
		}
	} */

	handleNeighbors(event: SweepEvent): void {
		const eventTree = this.eventTree;
		const before = event.before!;
		const after = event.after!;

		let key: f64;
		let id1 = before.id;
		let id2 = (before.node.next as EdgeNode).bundle.id;

		if(id1 < id2) {
			key = (id1 as f64) * (1 << 26 as f64) + (id2 as f64);
		} else {
			key = (id2 as f64) * (1 << 26 as f64) + (id1 as f64);
		}

		if(!this.crossings.has(key)) {
			const intersection = checkIntersection(before, (before.node.next as EdgeNode).bundle);

			if(intersection) {
				const event = eventTree.insert(intersection).node;
				event.addCross(intersection.a, intersection.b, key);
				this.crossings.add(key);
			}
		}

		if(after == (before.node.next as EdgeNode).bundle) return;

		id1 = after.id;
		id2 = (after.node.prev as EdgeNode).bundle.id;

		if(id1 < id2) {
			key = id1 * (1 << 26) + id2;
		} else {
			key = id2 * (1 << 26) + id1;
		}

		if(!this.crossings.has(key)) {
			const intersection = checkIntersection((after.node.prev as EdgeNode).bundle, after);

			if(intersection) {
				const event = eventTree.insert(intersection).node;
				event.addCross(intersection.a, intersection.b, key);
				this.crossings.add(key);
			}
		}
	}

	private syncNodesIntoTree(nodeAfter: EdgeNode, nodes: EdgeNode[], bundles: EdgeBundle[]): void {
		let num = 0;
		const count = bundles.length < nodes.length ? bundles.length : nodes.length;

		// checkTree(this.crossTree, this.steps);

		for(num = 0; num < count; ++num) {
			nodes[num].bundle = bundles[num];
			bundles[num].node = nodes[num];
		}

		// Remove excess nodes.
		if(bundles.length < nodes.length) {
			// TODO: Maybe 2 passes, first try removing only leaf nodes or nodes with only one child?
			while(num < nodes.length) {
				this.crossTree.remove(nodes[num++]);
			}
		}

		// checkTree(this.crossTree, this.steps);

		// Insert extra nodes.
		if(bundles.length > nodes.length) {
			let node = nodeAfter.prev as EdgeNode;

			while(num < bundles.length) {
				const child = new EdgeNode(bundles[num++]);

				if(node.right) {
					const prev = node;
					node = node.next as EdgeNode;
					node.left = child;
					child.prev = prev;
					prev.next = child;
					node.prev = child;
				} else {
					node.right = child;
					node.next = child;
					child.prev = node;
				}

				child.parent = node;
				node = child;
			}

			node.next = nodeAfter;
			nodeAfter.prev = node;

			this.crossTree.root = node.splay() as EdgeNode;
		}
	}

	step(): boolean {
		++this.steps;
		const event = this.eventTree.first;

		// If no events remain, this algorithm has finished.
		if(!event) {
			// console.log(splits, this.nextStart, points, crossings.length, SweepEvent.allocated, EdgeBundle.allocated);
			return false;
		}

		this.eventTree.remove(event);

		// if(this.steps == 10) debugger;

		let regionBeforeEvent: MonotoneRegion | null = null;
		let regionAfterEvent: MonotoneRegion | null = null;

		const transitionNodes = this.transitionNodes;
		const edges: Edge[] = [];
		let nodes: EdgeNode[] | null = null;

		if(event.bend.length || event.crossCount) {
			nodes = this.updateNeighbors(event);

			const transitions = this.updateStatusBefore(event, transitionNodes);

			if(!event.before!.afterIsInside) {
				let transition: u32 = 0;

				while(transition < transitions && !regionBeforeEvent) {
					const node = transitionNodes[transition++];
					const region = node.bundle.region!;

					if(!region.closed) regionBeforeEvent = region;
				}
			}

			if(event.after!.afterIsInside) {
				let transition = transitions;

				while(transition && !regionAfterEvent) {
					const node = transitionNodes[--transition];
					const region = node.bundle.region!;

					if(!region.closed) regionAfterEvent = region;
				}
			}
		}

		if(event.crossCount) {
			for(let num = event.crossKeys.length; num--;) {
				this.crossings.delete(event.crossKeys[num]);
			}
		}

		this.handleConnectedEdges(event, edges);

		// Add new edges starting from a top corner at this point.
		if(event == this.latestStart) {
			if(this.nextStart < (this.startPoints.length as u32)) {
				this.updateStart();
			} else {
				this.latestStart = null;
			}

			this.handleNewEdges(event, edges);
		}

		// Sort new edges.
		edges.sort((a, b) => a.angleDeltaFrom(b));

		let firstEdge = 0;

		if(!nodes) {
			const insertion = this.crossTree.insert(edges[0]);
			const delta = insertion.delta;
			const node = insertion.node;

			event.before = (node.prev as EdgeNode).bundle;
			event.after = (node.next as EdgeNode).bundle;

			if(delta !== 0) {
				node.bundle.insert(edges[firstEdge++]);

				if(edges.length == 1) this.crossTree.root = node.splay() as EdgeNode;
			} else {
				// There was already a single bundle passing through this point,
				// and newly added edges touch it.

				this.updateStatusBefore(event, transitionNodes);
			}

			if(!event.before!.afterIsInside && node.bundle.count & 1) {
				regionBeforeEvent = node.bundle.region;
			}

			if(event.after!.afterIsInside) {
				regionAfterEvent = node.bundle.region || findNextRegion(node);
			}

			nodes = [node];
		}

		const bundles = mergeEdgesIntoNodes(nodes, edges, firstEdge);
		this.syncNodesIntoTree(event.after!.node, nodes, bundles);

		if(event.before!.afterIsInside) {
			regionBeforeEvent = findPreviousRegion(event.before!.node.next as EdgeNode);
		}

		if(!event.after!.afterIsInside) {
			regionAfterEvent = findNextRegion(event.after!.node.prev as EdgeNode);
		}

		this.updateStatusAfter(event, regionBeforeEvent, regionAfterEvent, transitionNodes);
		this.handleNeighbors(event);

		event.free();

		return true;
	}

	steps: u32 = 0;

	rings: Ring[] = [];
	startPoint = {} as RationalPoint;
	startPoints: PointRef[];
	eventTree: SplayTree<SweepEvent, RationalPoint> = new SplayTree(SweepEvent.create);
	crossTree: SplayTree<EdgeNode, Line> = new SplayTree(EdgeNode.create);
	latestStart: SweepEvent | null = null;
	nextStart: u32 = 0;
	crossings: Set<f64> = new Set<f64>();

	allNodes: EdgeNode[] = [];
	transitionNodes: EdgeNode[] = [];

	// Output
	intersectionPoints: Point[] = [];
	monotoneRegions: MonotoneRegion[] = [];

	// Insert sentinels at both ends of the sweep line.
	sentinelBefore: EdgeNode = this.crossTree.insert({ x: -limit, y: -limit, x2: -limit, y2: limit }).node;
	sentinelAfter: EdgeNode = this.crossTree.insert({ x: limit, y: -limit, x2: limit, y2: limit }).node;

}
