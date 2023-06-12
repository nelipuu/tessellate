import { linearize, delinearize } from './srgb';

function cube(x: number) {
	if(x <= 8) return x * 27 / 24389;

	x = (x + 16) / 116;
	return x * x * x;
}

function root(x: number) {
	return x <= 216 / 24389 ? x * 24389 / 2700 : 1.16 * Math.pow(x, 1 / 3) - 0.16;
}

/** @param L Lightness 0 - 1
  * @param a */

export function srlab2rgb(L: number, a: number, b: number, out: number[] = []) {
	L *= 100;

	const x = cube(L + 9.04127 * a + 4.56344 * b);
	const y = cube(L - 5.33159 * a - 2.69178 * b);
	const z = cube(L - 58 * b);

	out[0] = delinearize(5.435679 * x - 4.599131 * y + 0.163593 * z);
	out[1] = delinearize(-1.16809 * x + 2.327977 * y - 0.159798 * z);
	out[2] = delinearize(0.03784 * x - 0.198564 * y + 1.160644 * z);

	return out;
}

const deg2rad = Math.PI / 180;

export function srlch2rgb(luminance: number, chroma: number, hue: number, out: number[] = []) {
	return srlab2rgb(
		luminance,
		chroma * Math.cos(hue * deg2rad),
		chroma * Math.sin(hue * deg2rad),
		out
	);
}

export function rgb2srlab(r: number, g: number, b: number, out: number[] = []) {
	r = linearize(r);
	g = linearize(g);
	b = linearize(b);

	const x = root(0.32053 * r + 0.63692 * g + 0.04256 * b);
	const y = root(0.161987 * r + 0.756636 * g + 0.081376 * b);
	const z = root(0.017228 * r + 0.10866 * g + 0.874112 * b);

	out[0] = 0.37095 * x + 0.629054 * y - 0.000008 * z;
	out[1] = 6.634684 * x - 7.505078 * y + 0.870328 * z;
	out[2] = 0.639569 * x + 1.084576 * y - 1.724152 * z;

	return out;
}
