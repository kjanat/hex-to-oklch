/**
 * Tiny, zero-dependency hex-to-OKLCH color converter.
 *
 * Converts CSS hex color strings to the OKLCH perceptual color space
 * using Björn Ottosson's OKLab matrices. Supports `#RGB`, `#RRGGBB`,
 * `#RGBA`, and `#RRGGBBAA` inputs (alpha is discarded).
 *
 * @example
 * ```ts
 * import { hexToOklch, formatOklch } from "hex-to-oklch";
 *
 * const oklch = hexToOklch("#ff6600");
 * // { l: 0.6958..., c: 0.2043..., h: 43.49... }
 *
 * formatOklch(oklch);
 * // "oklch(69.58% 0.2043 43.49)"
 * ```
 *
 * @module
 */

/**
 * OKLCH color with lightness, chroma, and hue.
 *
 * Achromatic colors (grays) have chroma near `0` and hue set to `0`
 * rather than `NaN` — simplifies arithmetic at the cost of not
 * distinguishing "hue is red" from "hue is powerless".
 */
export type Oklch = {
	/** Perceptual lightness. `0` = black, `1` = white. */
	readonly l: number;
	/** Chroma (colorfulness). `0` = gray, typically maxes around `0.4`. */
	readonly c: number;
	/** Hue angle in degrees `[0, 360)`. `0` for achromatic colors. */
	readonly h: number;
};

/**
 * Parse a hex color string into sRGB components in the range `[0, 1]`.
 *
 * Accepts `#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA` with an optional `#`
 * prefix. Alpha channel is silently discarded.
 *
 * @param hex - Hex color string to parse.
 * @returns Tuple of `[r, g, b]` in `[0, 1]`.
 * @throws {Error} If the string contains non-hex characters or has an
 *   unsupported length.
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
		const r = s.slice(0, 1);
		const g = s.slice(1, 2);
		const b = s.slice(2, 3);
		return [
			parseInt(r + r, 16) / 255,
			parseInt(g + g, 16) / 255,
			parseInt(b + b, 16) / 255,
		];
	}

	throw new Error(`Invalid hex color: ${hex}`);
}

/**
 * sRGB gamma decode per IEC 61966-2-1.
 *
 * @param c - sRGB component in `[0, 1]`.
 * @returns Linear-light value in `[0, 1]`.
 */
function srgbToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Convert linear sRGB to OKLab via LMS cone-response intermediary.
 *
 * @param r - Linear red in `[0, 1]`.
 * @param g - Linear green in `[0, 1]`.
 * @param b - Linear blue in `[0, 1]`.
 * @returns Tuple of `[L, a, b]` in OKLab space.
 * @see {@link https://bottosson.github.io/posts/oklab/ | Björn Ottosson — A perceptual color space for image processing}
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

/**
 * Convert a hex color string to OKLCH.
 *
 * Pipeline: hex → sRGB → linear sRGB → OKLab → OKLCH (polar form).
 *
 * @param hex - CSS hex color (`#RGB`, `#RRGGBB`, `#RGBA`, or `#RRGGBBAA`).
 *   The `#` prefix is optional. Alpha is discarded.
 * @returns OKLCH color with `l` in `[0, 1]`, `c >= 0`, `h` in `[0, 360)`.
 * @throws {Error} If `hex` is not a valid hex color string.
 *
 * @example
 * ```ts
 * hexToOklch("#ff0000");
 * // { l: 0.6279..., c: 0.2577..., h: 29.23... }
 *
 * hexToOklch("#808080");
 * // { l: 0.5999..., c: ≈0, h: 0 }  — achromatic
 * ```
 */
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
 * Out-of-range values are clamped: `l` to `[0, 1]`, `c` to `[0, +Inf)`,
 * `h` to `[0, 360)`.
 *
 * @param oklch - OKLCH color to format.
 * @returns CSS string, e.g. `"oklch(62.8% 0.2577 29.23)"`.
 *
 * @example
 * ```ts
 * formatOklch(hexToOklch("#ff0000"));
 * // "oklch(62.8% 0.2577 29.23)"
 *
 * formatOklch({ l: 0, c: 0, h: 0 });
 * // "oklch(0% 0 0)"
 * ```
 *
 * @see {@link hexToOklch} to produce valid `Oklch` values from hex strings.
 */
export function formatOklch({ l, c, h }: Oklch): string {
	const L = Math.max(0, Math.min(1, l));
	const C = Math.max(0, c);
	const H = ((h % 360) + 360) % 360;
	return `oklch(${+(L * 100).toFixed(2)}% ${+C.toFixed(4)} ${+H.toFixed(2)})`;
}
