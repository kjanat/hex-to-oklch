/** OKLCH color with lightness, chroma, and hue. */
export type Oklch = {
	/** Lightness (0-1) */
	readonly l: number;
	/** Chroma (0+) */
	readonly c: number;
	/** Hue in degrees [0, 360). 0 when chroma is below perceptual threshold (achromatic). */
	readonly h: number;
};

/**
 * Parse a hex color string into sRGB components (0-1).
 *
 * Accepts `#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA` (alpha is discarded).
 */
function parseHex(hex: string): [r: number, g: number, b: number] {
	const s = hex.startsWith('#') ? hex.slice(1) : hex;

	if (!/^[0-9a-f]+$/i.test(s)) {
		throw new Error(`Invalid hex color: ${hex}`);
	}

	if (s.length === 6 || s.length === 8) {
		return [
			parseInt(s.slice(0, 2), 16) / 255,
			parseInt(s.slice(2, 4), 16) / 255,
			parseInt(s.slice(4, 6), 16) / 255,
		];
	}

	if (s.length === 3 || s.length === 4) {
		const r = s[0];
		const g = s[1];
		const b = s[2];
		if (r === undefined || g === undefined || b === undefined) {
			throw new Error(`Invalid hex color: ${hex}`);
		}
		return [
			parseInt(r + r, 16) / 255,
			parseInt(g + g, 16) / 255,
			parseInt(b + b, 16) / 255,
		];
	}

	throw new Error(`Invalid hex color: ${hex}`);
}

/** sRGB gamma decode (sRGB component to linear). */
function srgbToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Convert linear sRGB to OKLab.
 *
 * Matrices from Björn Ottosson @see {@link https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab}
 */
function linearSrgbToOklab(
	r: number,
	g: number,
	b: number,
): [L: number, a: number, b: number] {
	// Linear sRGB → LMS (cone response)
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

	// LMS → OKLab
	return [
		0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
	];
}

/** Convert a hex color string to OKLCH. Accepts `#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA`. */
export function hexToOklch(hex: string): Oklch {
	const [r, g, b] = parseHex(hex);
	const [L, a, ob] = linearSrgbToOklab(
		srgbToLinear(r),
		srgbToLinear(g),
		srgbToLinear(b),
	);
	const c = Math.sqrt(a * a + ob * ob);
	// Threshold below perceptual chroma; catches floating-point residuals on achromatics
	const h = c < 1e-4 ? 0 : ((Math.atan2(ob, a) * 180) / Math.PI + 360) % 360;
	return { l: L, c, h };
}

/**
 * Format an OKLCH color as a CSS `oklch()` string.
 *
 * Values are clamped to valid ranges: L to 0-1, C to 0+, H to 0-360.
 * @see {@link hexToOklch} to produce valid `Oklch` values from hex strings.
 */
export function formatOklch({ l, c, h }: Oklch): string {
	const L = Math.max(0, Math.min(1, l));
	const C = Math.max(0, c);
	const H = ((h % 360) + 360) % 360;
	return `oklch(${+(L * 100).toFixed(2)}% ${+C.toFixed(4)} ${+H.toFixed(2)})`;
}
