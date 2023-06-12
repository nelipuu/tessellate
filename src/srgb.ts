export function linearize(x: number) {
	x /= 255;

	return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

export function delinearize(x: number) {
	x = x <= 0.0031308 ? x * 12.92 : Math.pow(x, 1 / 2.4) * 1.055 - 0.055;

	return Math.round(x * 255);
}
