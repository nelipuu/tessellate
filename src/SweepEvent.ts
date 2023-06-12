import { SplayItem } from './SplayItem';
import { RationalPoint, PointRef, Edge, EdgeBundle } from './Edge';
import { epsilon, twoSumLo, bigSum, smallProd, bigProd, perpDotExact } from './orient';

type f64 = number;
type i32 = number;
type u32 = number;

/** Point where two lines intersect, between the endpoints of both lines. */

export interface IntersectionPoint extends RationalPoint {
	w: f64;
	xErr: f64;
	yErr: f64;
	wErr: f64;
};

export interface ExactPoint extends IntersectionPoint {
	xExact: f64[];
	xExactLen: u32;
	yExact: f64[];
	yExactLen: u32;
	wExact: f64[];
	wExactLen: u32;
};

function compareRational(
	n1: f64,
	n1Err: f64,
	d1: f64,
	d1Err: f64,
	n2: f64,
	n2Err: f64,
	d2: f64,
	d2Err: f64
): f64 {
	let det = n1 * d2 - n2 * d1;

	if(n1 < 0) n1 = -n1;
	if(d1 < 0) d1 = -d1;
	if(n2 < 0) n2 = -n2;
	if(d2 < 0) d2 = -d2;

	const maxErr = (
		n1 * d2Err + n1Err * d2 + n1Err * d2Err +
		n2 * d1Err + n2Err * d1 + n2Err * d1Err
	) * (1 + epsilon * 8);

	if(det >= maxErr || -det >= maxErr) return det;

	return 0;
}

/** @param xyExact Floating point expansion to overwrite with result.
  * @return Length of resulting expansion. */

function scaleComponent(
	wExactLen: u32,
	wExact: f64[],
	second: f64,
	offsetLen: u32,
	offset: f64[],
	deltaHi: f64,
	deltaLo: f64,
	xyExact: f64[]
): u32 {
	const left: f64[] = [];
	const leftLen = smallProd(wExactLen, wExact, second, left);
	let right: f64[] = [];
	let rightLen = smallProd(offsetLen, offset, deltaHi, right);

	if(deltaLo) {
		const rightHi = right;
		const rightLo: f64[] = [];
		const rightLoLen = smallProd(offsetLen, offset, deltaLo, rightLo);

		right = [];
		rightLen = bigSum(rightLen, rightHi, rightLoLen, rightLo, right);
	}

	return bigSum(leftLen, left, rightLen, right, xyExact);
}

function makeExact(point: RationalPoint): point is ExactPoint {
	if(!point.w) return false;
	if(point.wExact) return true;

	const a = point.a!;
	const b = point.b!;

	point.wExact = [];
	point.wExactLen = perpDotExact(a.x, a.y, a.x2, a.y2, b.x, b.y, b.x2, b.y2, point.wExact);

	const offset: f64[] = [];
	const offsetLen = perpDotExact(a.x2, a.y2, b.x, b.y, a.x2, a.y2, b.x2, b.y2, offset);

	const dxHi = a.x2 - a.x;
	const dyHi = a.y2 - a.y;

	// Compute in arbitrary precision: point.xExact = a.x2 * wExact + (a.x2 - a.x) * offset;
	point.xExact = [];
	point.xExactLen = scaleComponent(
		point.wExactLen,
		point.wExact,
		a.x2,
		offsetLen,
		offset,
		dxHi,
		twoSumLo(a.x2, -a.x, dxHi),
		point.xExact
	);

	// Compute in arbitrary precision: point.yExact = a.y2 * wExact + (a.y2 - a.y) * offset;
	point.yExact = [];
	point.yExactLen = scaleComponent(
		point.wExactLen,
		point.wExact,
		a.y2,
		offsetLen,
		offset,
		dyHi,
		twoSumLo(a.y2, -a.y, dyHi),
		point.yExact
	);

	return true;
}

export class SweepEvent extends SplayItem<RationalPoint> {

	constructor() {
		super();
		++SweepEvent.allocated;
	}

	static create(key: RationalPoint): SweepEvent {
		const event = (SweepEvent.firstFree || new SweepEvent()) as SweepEvent;
		const point = event.point;
		SweepEvent.firstFree = event.nextFree;

		point.x = key.x;
		point.y = key.y;
		point.w = key.w || 0;
		point.xErr = key.xErr || 0;
		point.yErr = key.yErr || 0;
		point.wErr = key.wErr || 0;

		if(key.w) {
			point.a = key.a;
			point.b = key.b;
			point.xExact = key.xExact;
			point.xExactLen = key.xExactLen;
			point.yExact = key.yExact;
			point.yExactLen = key.yExactLen;
			point.wExact = key.wExact;
			point.wExactLen = key.wExactLen;
		}

		return event;
	}

	deltaFrom(key: RationalPoint): f64 {
		const point = this.point;

		if(!point.w && !key.w) {
			return point.y - key.y || point.x - key.x;
		}

		const w = point.w || 1;
		const keyW = key.w || 1;
		const keyYErr = key.yErr;
		const keyWErr = key.wErr;

		let det = compareRational(
			point.y,
			point.yErr,
			w,
			point.wErr,
			key.y,
			keyYErr,
			keyW,
			keyWErr
		);
		if(det) return det;

		// Compute exact x, y, w values and compare again.

		const sum: f64[] = [];
		let sumLen: u32;

		if(makeExact(point) && makeExact(key)) {

			// Compute in arbitrary precision:
			// this.yExact * key.wExact - key.yExact * this.wExact ||
			// this.xExact * key.wExact - key.xExact * this.wExact

			const left: f64[] = [];
			const right: f64[] = [];
			let leftLen = bigProd(point.yExactLen, point.yExact, key.wExactLen, key.wExact, left);
			let rightLen = bigProd(key.yExactLen, key.yExact, point.wExactLen, point.wExact, right);

			for(let pos: u32 = 0; pos < rightLen; ++pos) {
				right[pos] = -right[pos];
			}

			sumLen = bigSum(leftLen, left, rightLen, right, sum);
			if(sumLen) return sum[sumLen - 1];

			leftLen = bigProd(point.xExactLen, point.xExact, key.wExactLen, key.wExact, left);
			rightLen = bigProd(key.xExactLen, key.xExact, point.wExactLen, point.wExact, right);

			for(let pos: u32 = 0; pos < rightLen; ++pos) {
				right[pos] = -right[pos];
			}

			sumLen = bigSum(leftLen, left, rightLen, right, sum);
			return sumLen ? sum[sumLen - 1] : 0;
		} else if(makeExact(point)) {
			const right: f64[] = [];
			let rightLen = smallProd(point.wExactLen, point.wExact!, -key.y, right);
			sumLen = bigSum(point.yExactLen, point.yExact!, rightLen, right, sum);
			if(sumLen) return sum[sumLen - 1];

			rightLen = smallProd(point.wExactLen, point.wExact!, -key.x, right);
			sumLen = bigSum(point.xExactLen, point.xExact!, rightLen, right, sum);
			return sumLen ? sum[sumLen - 1] : 0;
		} else if(makeExact(key)) {
			const left: f64[] = [];
			let leftLen = smallProd(key.wExactLen, key.wExact!, -point.y, left);
			sumLen = bigSum(key.yExactLen, key.yExact!, leftLen, left, sum);
			if(sumLen) return -sum[sumLen - 1];

			leftLen = smallProd(key.wExactLen, key.wExact!, -point.x, left);
			sumLen = bigSum(key.xExactLen, key.xExact!, leftLen, left, sum);
			return sumLen ? -sum[sumLen - 1] : 0;
		}

		// Not reached.
		return 0;
	}

	addCross(a: EdgeBundle | null, b: EdgeBundle | null, key: f64): void {
		if(a) this.cross[this.crossCount++] = a;
		if(b) this.cross[this.crossCount++] = b;
		this.crossKeys.push(key);
	}

	free(): void {
		this.reset();

		this.startCount = 0;
		this.bend.length = 0;
		this.crossCount = 0;
		this.crossKeys.length = 0;
		this.before = null;
		this.after = null;
		this.point.reported = false;

		this.nextFree = SweepEvent.firstFree;
		SweepEvent.firstFree = this;
	}

	private static firstFree: SweepEvent | null = null;
	nextFree: SweepEvent | null = null;
	static allocated: u32 = 0;

	start: (PointRef | null)[] = [];
	startCount: u32 = 0;
	bend: Edge[] = [];
	cross: (EdgeBundle | null)[] = [];
	crossCount: u32 = 0;
	crossKeys: f64[] = [];

	/** Neighbor bundle before this event along the sweep line. */
	before: EdgeBundle | null = null;

	/** Neighbor bundle after this event along the sweep line. */
	after: EdgeBundle | null = null;

	point = {} as RationalPoint;

}
