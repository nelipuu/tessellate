import { Point, RationalPoint, EdgeBundle } from './Edge';

export interface Vertex extends Point {
	isLeft: boolean;
}

export class MonotoneRegion {

	addVertex(
		point: RationalPoint | Vertex,
		bundle: EdgeBundle,
		isLeft: boolean,
		isMerge: boolean
	): Vertex {
		const w = (point as RationalPoint).w || 1;

		// This is where calculated intersection points get rounded to floats in output.
		const vertex: Vertex = {
			x: point.x / w,
			y: point.y / w,
			isLeft
		};

		if(this.closed) {
			this.closed = false;
			this.hasError = true;
		}

		this.vertices.push(vertex);

		this.latestVertex = vertex;
		this.latestBundle = bundle;
		this.latestIsMerge = isMerge;

		return vertex;
	}

	vertices: Vertex[] = [];
	closed: boolean = false;
	hasError: boolean = false;

	latestVertex: Vertex | null = null;
	latestBundle: EdgeBundle | null = null;
	latestIsMerge: boolean = false;

}
