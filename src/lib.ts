/**
 * Tiny, zero-dependency hex/RGB color to OKLCH converter.
 *
 * Converts CSS hex color strings to the OKLCH perceptual color space
 * using Björn Ottosson's OKLab matrices. Supports `#RGB`, `#RGBA`,
 * `#RRGGBB`, and `#RRGGBBAA` inputs (alpha preserved by default, configurable).
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
 * Chroma at or below this value is perceptually achromatic; hue is
 * meaningless floating-point noise.
 *
 * Used by {@link hexToOklch} to zero the hue of grays and by
 * {@link formatOklch} to emit the CSS `none` keyword for powerless hue.
 *
 * @see {@link https://www.w3.org/TR/css-color-4/#powerless | CSS Color 4 §4.4.1 — “Powerless” Color Components}
 */
export const ACHROMATIC_CHROMA_THRESHOLD = 4e-6;

/**
 * Whether an OKLCH color is achromatic (a gray without meaningful hue).
 *
 * CSS Color 4 §4.4.1 defines hue as "powerless" when chroma is zero.
 * This function uses {@link ACHROMATIC_CHROMA_THRESHOLD} to account
 * for floating-point residuals in the sRGB → OKLab conversion.
 *
 * @param oklch - Color to test.
 * @returns `true` when chroma is at or below the perceptual threshold.
 * @see {@link https://www.w3.org/TR/css-color-4/#powerless | CSS Color 4 §4.4.1 — “Powerless” Color Components}
 */
export function isAchromatic(oklch: Oklch): boolean {
	return oklch.c <= ACHROMATIC_CHROMA_THRESHOLD;
}

/**
 * OKLCH color with lightness, chroma, and hue.
 *
 * Achromatic colors (grays) have chroma near `0` and hue set to `0`
 * rather than `NaN` — simplifies arithmetic at the cost of not
 * distinguishing "hue is red" from "hue is powerless". Use
 * {@link isAchromatic} to detect powerless hue, and
 * {@link formatOklch} to produce spec-correct CSS with `none`.
 *
 * @see {@link https://www.w3.org/TR/css-color-4/#powerless | CSS Color 4 §4.4.1 — “Powerless” Color Components}
 */
export type Oklch = {
	/** Perceptual lightness. `0` = black, `1` = white. */
	readonly l: number;
	/** Chroma (colorfulness). `0` = gray, typically maxes around `0.4`. */
	readonly c: number;
	/** Hue angle in degrees `[0, 360)`. `0` for achromatic colors. */
	readonly h: number;
	/** Alpha channel in `[0, 1]` when source input includes transparency. */
	readonly a?: number;
};

/**
 * OKLCH color with alpha channel.
 *
 * Alpha uses CSS semantics: `0` = fully transparent, `1` = fully opaque.
 */
export type Oklcha = Oklch & {
	readonly a: number;
};

/**
 * Alpha-handling strategy for {@link hexToOklch}.
 */
export type HexToOklchOptions = {
	readonly alpha?: 'preserve';
} | {
	readonly alpha: 'discard';
} | {
	readonly alpha: 'override';
	readonly value: number;
};

type ParsedHex =
	| {
		readonly r: number;
		readonly g: number;
		readonly b: number;
	}
	| {
		readonly r: number;
		readonly g: number;
		readonly b: number;
		readonly a: number;
	};

/**
 * Parse a hex color string into sRGB components in the range `[0, 1]`.
 *
 * Accepts `#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA` with an optional `#`
 * prefix.
 *
 * @param hex - Hex color string to parse.
 * @returns Parsed color with `r`, `g`, `b` in `[0, 1]` and `a` in
 *   `[0, 1]` when alpha is present.
 * @throws {Error} If the string contains non-hex characters or has an
 *   unsupported length.
 */
function parseHex(hex: string): ParsedHex {
	const s = hex.startsWith('#') ? hex.slice(1) : hex;

	if (!/^[0-9a-f]+$/i.test(s)) {
		throw new Error(`Invalid hex color: ${hex}`);
	}

	if (s.length === 6 || s.length === 8) {
		const rgb = {
			r: parseInt(s.slice(0, 2), 16) / 255,
			g: parseInt(s.slice(2, 4), 16) / 255,
			b: parseInt(s.slice(4, 6), 16) / 255,
		};

		if (s.length === 8) {
			return {
				...rgb,
				a: parseInt(s.slice(6, 8), 16) / 255,
			};
		}

		return rgb;
	}

	if (s.length === 3 || s.length === 4) {
		const r = s.slice(0, 1);
		const g = s.slice(1, 2);
		const b = s.slice(2, 3);
		const rgb = {
			r: parseInt(r + r, 16) / 255,
			g: parseInt(g + g, 16) / 255,
			b: parseInt(b + b, 16) / 255,
		};

		if (s.length === 4) {
			const a = s.slice(3, 4);
			return {
				...rgb,
				a: parseInt(a + a, 16) / 255,
			};
		}

		return rgb;
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
 * Clamp alpha override to `[0, 1]` and reject non-finite numbers.
 *
 * @param value - Candidate alpha override.
 * @returns Clamped alpha in `[0, 1]`.
 * @throws {Error} If `value` is not finite.
 */
function normalizeAlphaOverride(value: number): number {
	if (!Number.isFinite(value)) {
		throw new Error(`Invalid alpha override: ${value}`);
	}

	return Math.max(0, Math.min(1, value));
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
 * Convert sRGB components in `[0, 1]` to OKLCH.
 *
 * Shared conversion core used by both {@link hexToOklch} and
 * {@link rgbToOklch}. Pipeline: sRGB → linear sRGB → OKLab → OKLCH.
 */
function srgbToOklchCore(r: number, g: number, b: number): { l: number; c: number; h: number } {
	const [L, a, ob] = linearSrgbToOklab(
		srgbToLinear(r),
		srgbToLinear(g),
		srgbToLinear(b),
	);
	const c = Math.sqrt(a * a + ob * ob);
	const h = c <= ACHROMATIC_CHROMA_THRESHOLD
		? 0
		: ((Math.atan2(ob, a) * 180) / Math.PI + 360) % 360;
	return { l: L, c, h };
}

/**
 * Convert a hex color string to OKLCH.
 *
 * Pipeline: hex → sRGB → linear sRGB → OKLab → OKLCH (polar form).
 *
 * @param hex - CSS hex color (`#RGB`, `#RRGGBB`, `#RGBA`, or `#RRGGBBAA`).
 *   The `#` prefix is optional.
 * @param options - Optional conversion settings.
 * @param options.alpha - Alpha strategy:
 *   - `preserve` (default): keep parsed alpha when present
 *   - `discard`: always omit alpha
 *   - `override`: always use `options.value` as alpha
 * @param options.value - Alpha value used when `options.alpha` is `override`.
 *   Clamped to `[0, 1]`.
 * @returns OKLCH color with `l` in `[0, 1]`, `c >= 0`, `h` in `[0, 360)`,
 *   and `a` in `[0, 1]` when alpha is preserved or overridden.
 * @throws {Error} If `hex` is not a valid hex color string, or if
 *   `options.alpha` is `override` and `options.value` is non-finite.
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
export function hexToOklch(
	hex: string,
	options?: HexToOklchOptions,
): Oklch {
	const parsed = parseHex(hex);
	const { r, g, b } = parsed;
	const oklch = srgbToOklchCore(r, g, b);

	if (options?.alpha === 'discard') {
		return oklch;
	}

	if (options?.alpha === 'override') {
		return {
			...oklch,
			a: normalizeAlphaOverride(options.value),
		};
	}

	if ('a' in parsed) {
		return {
			...oklch,
			a: parsed.a,
		};
	}

	return oklch;
}

/**
 * RGB color input for {@link rgbToOklch}.
 *
 * Channels are integers in `[0, 255]` (clamped and rounded). Alpha, when
 * present, is in `[0, 1]` (clamped).
 */
export type RgbInput = {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a?: number;
};

/**
 * Convert raw RGB values to OKLCH.
 *
 * Pipeline: sRGB `[0, 255]` → normalized `[0, 1]` → linear sRGB → OKLab → OKLCH.
 *
 * Accepts either positional arguments or a single {@link RgbInput} object.
 *
 * @param r - Red channel in `[0, 255]`. Clamped to `[0, 255]` and rounded.
 * @param g - Green channel in `[0, 255]`. Clamped to `[0, 255]` and rounded.
 * @param b - Blue channel in `[0, 255]`. Clamped to `[0, 255]` and rounded.
 * @param alpha - Optional alpha in `[0, 1]`. When provided, the result
 *   includes an `a` property. Clamped to `[0, 1]`.
 * @returns OKLCH color with `l` in `[0, 1]`, `c >= 0`, `h` in `[0, 360)`,
 *   and `a` in `[0, 1]` when `alpha` is provided.
 * @throws {Error} If any of `r`, `g`, `b` is not a finite number, or if
 *   `alpha` is provided and not finite.
 *
 * @example
 * ```ts
 * import { rgbToOklch, formatOklch } from "hex-to-oklch";
 *
 * // Positional arguments
 * rgbToOklch(255, 0, 0);
 * // { l: 0.6279..., c: 0.2577..., h: 29.23... }
 *
 * // Object form
 * rgbToOklch({ r: 255, g: 102, b: 0, a: 0.5 });
 * // { l: 0.6958..., c: 0.2043..., h: 43.49..., a: 0.5 }
 *
 * formatOklch(rgbToOklch(128, 128, 128));
 * // "oklch(59.99% 0 none)"
 * ```
 */
export function rgbToOklch(r: number, g: number, b: number, alpha?: number): Oklch;
export function rgbToOklch(rgb: RgbInput): Oklch;
export function rgbToOklch(
	rOrRgb: number | RgbInput,
	g?: number,
	b?: number,
	alpha?: number,
): Oklch {
	if (rOrRgb !== null && typeof rOrRgb === 'object') {
		return rgbToOklch(rOrRgb.r, rOrRgb.g, rOrRgb.b, rOrRgb.a);
	}

	const r = rOrRgb;
	if (
		g === undefined
		|| b === undefined
		|| !Number.isFinite(r)
		|| !Number.isFinite(g)
		|| !Number.isFinite(b)
	) {
		throw new Error(`Invalid RGB values: ${r}, ${g}, ${b}`);
	}

	const oklch = srgbToOklchCore(
		Math.max(0, Math.min(255, Math.round(r))) / 255,
		Math.max(0, Math.min(255, Math.round(g))) / 255,
		Math.max(0, Math.min(255, Math.round(b))) / 255,
	);

	if (alpha !== undefined) {
		return { ...oklch, a: normalizeAlphaOverride(alpha) };
	}

	return oklch;
}

/**
 * Format an OKLCH color as a CSS `oklch()` string.
 *
 * Achromatic colors (where {@link isAchromatic} returns `true`) emit
 * the CSS `none` keyword for hue per CSS Color 4 §4.4, and zero their
 * chroma: `oklch(60% 0 none)`.
 *
 * Out-of-range values are clamped: `l` to `[0, 1]`, `c` to `[0, +Inf)`,
 * `h` to `[0, 360)`.
 *
 * @see {@link hexToOklch} to produce valid `Oklch` values from hex strings.
 * @see {@link https://www.w3.org/TR/css-color-4/#missing | CSS Color 4 §4.4 — “Missing” Color Components and the none Keyword}
 */
export function formatOklch(oklch: Oklch): string {
	const { l, c, h } = oklch;
	const L = Math.max(0, Math.min(1, l));
	const achromatic = isAchromatic(oklch);
	const C = achromatic ? 0 : Math.max(0, c);
	const hStr = achromatic ? 'none' : `${+(((h % 360) + 360) % 360).toFixed(2)}`;

	if (oklch.a !== undefined) {
		const A = Math.max(0, Math.min(1, oklch.a));
		return `oklch(${+(L * 100).toFixed(2)}% ${+C.toFixed(4)} ${hStr} / ${+A.toFixed(3)})`;
	}

	return `oklch(${+(L * 100).toFixed(2)}% ${+C.toFixed(4)} ${hStr})`;
}
