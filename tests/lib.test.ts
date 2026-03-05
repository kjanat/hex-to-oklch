import { describe, expect, test } from 'bun:test';
import type { Oklch } from 'hex-to-oklch';
import { ACHROMATIC_CHROMA_THRESHOLD, formatOklch, hexToOklch, isAchromatic, rgbToOklch } from 'hex-to-oklch';

/** Circular hue distance in degrees (handles wrap-around). */
function hueDist(a: number, b: number): number {
	const d = Math.abs(a - b) % 360;
	return Math.min(d, 360 - d);
}

/** Assert OKLCH values are close to expected, with circular hue comparison. */
function expectOklchClose(
	got: Oklch,
	exp: { l: number; c: number; h: number },
	eps = { l: 5e-4, c: 5e-4, h: 0.01 },
): void {
	expect(Math.abs(got.l - exp.l)).toBeLessThan(eps.l);
	expect(Math.abs(got.c - exp.c)).toBeLessThan(eps.c);
	expect(hueDist(got.h, exp.h)).toBeLessThan(eps.h);
}

describe('hexToOklch', () => {
	describe.concurrent('parsing', () => {
		test('#RRGGBB', () => {
			const o = hexToOklch('#ff0000');
			expect(o.l).toBeGreaterThan(0);
		});

		test('#RGB expands via digit duplication', () => {
			expectOklchClose(hexToOklch('#f00'), hexToOklch('#ff0000'));
			expectOklchClose(hexToOklch('#123'), hexToOklch('#112233'));
		});

		test('case insensitive', () => {
			expectOklchClose(hexToOklch('#FF0000'), hexToOklch('#ff0000'));
			expectOklchClose(hexToOklch('#AaBbCc'), hexToOklch('#aabbcc'));
			expectOklchClose(hexToOklch('#F00'), hexToOklch('#f00'));
		});

		test('hash prefix optional', () => {
			expectOklchClose(hexToOklch('ff0000'), hexToOklch('#ff0000'));
			expectOklchClose(hexToOklch('f00'), hexToOklch('#f00'));
			expectOklchClose(hexToOklch('ff000080'), hexToOklch('#ff000080'));
		});

		test.each([
			['#ff', 'wrong length (2)'],
			['#fffff', 'wrong length (5)'],
			['#fffffffff', 'wrong length (9)'],
			['#ggg', 'non-hex chars (3)'],
			['#12xz89', 'non-hex chars (6)'],
			['', 'empty string'],
			['#', 'bare hash'],
			['0xFFAA00', '0x prefix'],
		])('rejects %s — %s', (input) => {
			expect(() => hexToOklch(input)).toThrow('Invalid hex color');
		});
	});

	describe.concurrent('alpha options', () => {
		test('#RRGGBBAA — alpha preserved', () => {
			const noAlpha = hexToOklch('#ff0000');
			const transparent = hexToOklch('#ff000000');
			const mid = hexToOklch('#ff000080');
			const full = hexToOklch('#ff0000ff');

			expectOklchClose(transparent, noAlpha);
			expectOklchClose(mid, noAlpha);
			expectOklchClose(full, noAlpha);
			expect(transparent.a).toBe(0);
			expect(mid.a).toBeCloseTo(128 / 255, 10);
			expect(full.a).toBe(1);
		});

		test('#RGBA — alpha preserved', () => {
			const noAlpha = hexToOklch('#ff0000');
			const transparent = hexToOklch('#f000');
			const mid = hexToOklch('#f008');
			const full = hexToOklch('#f00f');

			expectOklchClose(transparent, noAlpha);
			expectOklchClose(mid, noAlpha);
			expectOklchClose(full, noAlpha);
			expect(transparent.a).toBe(0);
			expect(mid.a).toBeCloseTo(136 / 255, 10);
			expect(full.a).toBe(1);
		});

		test('alpha bytes do not affect RGB extraction', () => {
			const base = hexToOklch('#11223300');
			const mid = hexToOklch('#11223380');
			const full = hexToOklch('#112233ff');
			const noAlpha = hexToOklch('#112233');
			expect(base.l).toBe(noAlpha.l);
			expect(base.c).toBe(noAlpha.c);
			expect(base.h).toBe(noAlpha.h);
			expect(mid.l).toBe(noAlpha.l);
			expect(full.l).toBe(noAlpha.l);
			expect(base.a).toBe(0);
			expect(mid.a).toBeCloseTo(128 / 255, 10);
			expect(full.a).toBe(1);
			expect(noAlpha.a).toBeUndefined();
		});

		test('discard omits alpha for 4/8-digit hex', () => {
			const noAlpha = hexToOklch('#ff0000');
			const rgbaDiscarded = hexToOklch('#f008', { alpha: 'discard' });
			const rrggbbaaDiscarded = hexToOklch('#ff000080', { alpha: 'discard' });

			expectOklchClose(rgbaDiscarded, noAlpha);
			expectOklchClose(rrggbbaaDiscarded, noAlpha);
			expect(rgbaDiscarded.a).toBeUndefined();
			expect(rrggbbaaDiscarded.a).toBeUndefined();
			// Different hex inputs also produce no alpha
			expect(hexToOklch('#1234', { alpha: 'discard' }).a).toBeUndefined();
			expect(hexToOklch('#11223344', { alpha: 'discard' }).a).toBeUndefined();
		});

		test('override replaces alpha', () => {
			const noAlpha = hexToOklch('#ff0000');
			const rgbOverridden = hexToOklch('#ff0000', { alpha: 'override', value: 0.25 });
			const rgbaOverridden = hexToOklch('#ff000080', { alpha: 'override', value: 0.25 });

			expectOklchClose(rgbOverridden, noAlpha);
			expectOklchClose(rgbaOverridden, noAlpha);
			expect(rgbOverridden.a).toBe(0.25);
			expect(rgbaOverridden.a).toBe(0.25);
		});

		test('override clamps to [0, 1]', () => {
			expect(hexToOklch('#112233', { alpha: 'override', value: -1 }).a).toBe(0);
			expect(hexToOklch('#112233', { alpha: 'override', value: 2 }).a).toBe(1);
		});

		test('non-finite override throws', () => {
			expect(() => hexToOklch('#112233', { alpha: 'override', value: Number.NaN })).toThrow(
				'Invalid alpha override',
			);
			expect(() => hexToOklch('#112233', { alpha: 'override', value: Number.POSITIVE_INFINITY })).toThrow(
				'Invalid alpha override',
			);
		});
	});

	describe.concurrent('golden vectors', () => {
		// Reference values computed independently and verified against culori 4.0.2.
		// Tolerance: L ±5e-4, C ±5e-4, H ±0.01°

		const vectors: Array<[hex: string, label: string, expected: { l: number; c: number; h: number }]> = [
			// extremes
			['#000000', 'black', { l: 0, c: 0, h: 0 }],
			['#ffffff', 'white', { l: 1, c: 0, h: 0 }],
			// primaries
			['#ff0000', 'red', { l: 0.62796, c: 0.25768, h: 29.2339 }],
			['#00ff00', 'green', { l: 0.86644, c: 0.29483, h: 142.4953 }],
			['#0000ff', 'blue', { l: 0.45201, c: 0.31321, h: 264.052 }],
			// secondaries
			['#ffff00', 'yellow', { l: 0.96798, c: 0.21101, h: 109.7692 }],
			['#00ffff', 'cyan', { l: 0.9054, c: 0.15455, h: 194.769 }],
			['#ff00ff', 'magenta', { l: 0.70167, c: 0.32249, h: 328.3634 }],
			// grays
			['#808080', 'mid-gray', { l: 0.59987, c: 0, h: 0 }],
			['#777777', 'dark-gray', { l: 0.56926, c: 0, h: 0 }],
			['#010101', 'near-black', { l: 0.0672, c: 0, h: 0 }],
			// real-world
			['#bada55', 'bada55', { l: 0.83912, c: 0.16217, h: 121.448 }],
			['#c0ffee', 'c0ffee', { l: 0.95302, c: 0.06711, h: 176.357 }],
			['#663399', 'rebeccapurple', { l: 0.44027, c: 0.1603, h: 303.373 }],
		];

		test.each(vectors)('%s (%s)', (hex, _label, expected) => {
			expectOklchClose(hexToOklch(hex), expected);
		});
	});

	describe.concurrent('achromatic', () => {
		// CSS Color 4 §4.4.1: hue is "powerless" when chroma ≈ 0.
		// Our API represents this as h = 0 (not NaN) — documented design choice.

		test('pure grays have C ≈ 0 and h = 0', () => {
			for (const hex of ['#000000', '#010101', '#7f7f7f', '#808080', '#ffffff']) {
				const { c, h } = hexToOklch(hex);
				expect(c).toBeLessThan(1e-4);
				expect(h).toBe(0);
			}
		});

		test('almost-gray #808081 has real chroma and hue', () => {
			const { c, h } = hexToOklch('#808081');
			expect(c).toBeGreaterThan(1e-4);
			expect(h).toBeGreaterThan(0);
			expectOklchClose(hexToOklch('#808081'), { l: 0.60019, c: 0.00149, h: 286.355 });
		});

		test('all 16 grayscale steps are achromatic', () => {
			for (let i = 0; i <= 15; i++) {
				const hex = `#${i.toString(16)}${i.toString(16)}${i.toString(16)}`;
				const { c, h } = hexToOklch(hex);
				expect(c).toBeLessThan(1e-4);
				expect(h).toBe(0);
			}
		});
	});

	describe.concurrent('output invariants', () => {
		const SAMPLE_HEXES = /* dprint-ignore */ [
			'#000000', '#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff',
			'#ffff00', '#00ffff', '#ff00ff', '#010101', '#fefefe', '#123456',
			'#abcdef', '#fedcba', '#c0ffee', '#bada55', '#663399', '#deface',
			'#7f7f7f', '#010100', '#000100', '#100000', '#000001', '#080808',
		];

		test('L is in [0, 1] for all colors', () => {
			for (const hex of SAMPLE_HEXES) {
				const { l } = hexToOklch(hex);
				expect(l).toBeGreaterThanOrEqual(0);
				expect(l).toBeLessThanOrEqual(1.0001); // tiny float tolerance
			}
		});

		test('C >= 0 for all colors', () => {
			for (const hex of SAMPLE_HEXES) {
				expect(hexToOklch(hex).c).toBeGreaterThanOrEqual(0);
			}
		});

		test('h is in [0, 360) for all colors', () => {
			for (const hex of SAMPLE_HEXES) {
				const { h } = hexToOklch(hex);
				expect(h).toBeGreaterThanOrEqual(0);
				expect(h).toBeLessThan(360);
			}
		});

		test('all outputs are finite', () => {
			for (const hex of SAMPLE_HEXES) {
				const { l, c, h } = hexToOklch(hex);
				expect(Number.isFinite(l)).toBe(true);
				expect(Number.isFinite(c)).toBe(true);
				expect(Number.isFinite(h)).toBe(true);
			}
		});

		test('no -0 in output', () => {
			for (const hex of SAMPLE_HEXES) {
				const { l, c, h } = hexToOklch(hex);
				expect(Object.is(l, -0)).toBe(false);
				expect(Object.is(c, -0)).toBe(false);
				expect(Object.is(h, -0)).toBe(false);
			}
		});
	});
});

describe('rgbToOklch', () => {
	describe.concurrent('equivalence with hexToOklch', () => {
		const cases: Array<[hex: string, r: number, g: number, b: number]> = [
			['#000000', 0, 0, 0],
			['#ffffff', 255, 255, 255],
			['#ff0000', 255, 0, 0],
			['#00ff00', 0, 255, 0],
			['#0000ff', 0, 0, 255],
			['#808080', 128, 128, 128],
			['#bada55', 186, 218, 85],
			['#663399', 102, 51, 153],
			['#c0ffee', 192, 255, 238],
		];

		test.each(cases)('%s matches rgbToOklch(%d, %d, %d)', (hex, r, g, b) => {
			const fromHex = hexToOklch(hex);
			const fromRgb = rgbToOklch(r, g, b);
			expect(fromRgb.l).toBe(fromHex.l);
			expect(fromRgb.c).toBe(fromHex.c);
			expect(fromRgb.h).toBe(fromHex.h);
			expect(fromRgb.a).toBeUndefined();
		});
	});

	describe.concurrent('alpha', () => {
		test('no alpha by default', () => {
			expect(rgbToOklch(255, 0, 0).a).toBeUndefined();
		});

		test('alpha is included when provided', () => {
			const o = rgbToOklch(255, 0, 0, 0.5);
			expect(o.a).toBe(0.5);
		});

		test('alpha is clamped to [0, 1]', () => {
			expect(rgbToOklch(0, 0, 0, -1).a).toBe(0);
			expect(rgbToOklch(0, 0, 0, 2).a).toBe(1);
		});

		test('non-finite alpha throws', () => {
			expect(() => rgbToOklch(0, 0, 0, Number.NaN)).toThrow('Invalid alpha override');
			expect(() => rgbToOklch(0, 0, 0, Number.POSITIVE_INFINITY)).toThrow('Invalid alpha override');
		});
	});

	describe.concurrent('clamping and rounding', () => {
		test('values are clamped to [0, 255]', () => {
			expectOklchClose(rgbToOklch(-10, 0, 0), rgbToOklch(0, 0, 0));
			expectOklchClose(rgbToOklch(300, 255, 255), rgbToOklch(255, 255, 255));
		});

		test('fractional values are rounded', () => {
			expectOklchClose(rgbToOklch(127.6, 128.4, 128), rgbToOklch(128, 128, 128));
		});
	});

	describe.concurrent('validation', () => {
		test('non-finite values throw', () => {
			expect(() => rgbToOklch(Number.NaN, 0, 0)).toThrow('Invalid RGB values');
			expect(() => rgbToOklch(0, Number.POSITIVE_INFINITY, 0)).toThrow('Invalid RGB values');
			expect(() => rgbToOklch(0, 0, Number.NEGATIVE_INFINITY)).toThrow('Invalid RGB values');
		});
	});

	describe.concurrent('golden vectors', () => {
		const vectors: Array<[r: number, g: number, b: number, label: string, expected: { l: number; c: number; h: number }]> = [
			[0, 0, 0, 'black', { l: 0, c: 0, h: 0 }],
			[255, 255, 255, 'white', { l: 1, c: 0, h: 0 }],
			[255, 0, 0, 'red', { l: 0.62796, c: 0.25768, h: 29.2339 }],
			[0, 255, 0, 'green', { l: 0.86644, c: 0.29483, h: 142.4953 }],
			[0, 0, 255, 'blue', { l: 0.45201, c: 0.31321, h: 264.052 }],
		];

		test.each(vectors)('(%d, %d, %d) %s', (r, g, b, _label, expected) => {
			expectOklchClose(rgbToOklch(r, g, b), expected);
		});
	});

	describe.concurrent('object overload', () => {
		test('object form matches positional form', () => {
			const positional = rgbToOklch(186, 218, 85);
			const object = rgbToOklch({ r: 186, g: 218, b: 85 });
			expect(object.l).toBe(positional.l);
			expect(object.c).toBe(positional.c);
			expect(object.h).toBe(positional.h);
			expect(object.a).toBeUndefined();
		});

		test('alpha from object', () => {
			const o = rgbToOklch({ r: 255, g: 0, b: 0, a: 0.5 });
			expect(o.a).toBe(0.5);
			expectOklchClose(o, rgbToOklch(255, 0, 0));
		});

		test('alpha omitted from object', () => {
			expect(rgbToOklch({ r: 0, g: 0, b: 0 }).a).toBeUndefined();
		});

		test('non-finite values in object throw', () => {
			expect(() => rgbToOklch({ r: Number.NaN, g: 0, b: 0 })).toThrow('Invalid RGB values');
		});
	});
});

describe('isAchromatic', () => {
	test('true for pure grays from hexToOklch', () => {
		for (const hex of ['#000000', '#808080', '#ffffff', '#010101', '#7f7f7f']) {
			expect(isAchromatic(hexToOklch(hex))).toBe(true);
		}
	});

	test('false for chromatic colors', () => {
		for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#bada55', '#808081']) {
			expect(isAchromatic(hexToOklch(hex))).toBe(false);
		}
	});

	test('boundary: chroma exactly at threshold is achromatic', () => {
		expect(isAchromatic({ l: 0.5, c: ACHROMATIC_CHROMA_THRESHOLD, h: 0 })).toBe(true);
	});

	test('boundary: chroma just above threshold is not achromatic', () => {
		expect(isAchromatic({ l: 0.5, c: ACHROMATIC_CHROMA_THRESHOLD + 1e-15, h: 180 })).toBe(false);
	});

	test('strict epsilon: small non-zero chroma above 4e-6 is not achromatic', () => {
		expect(isAchromatic({ l: 0.5, c: 5e-5, h: 210 })).toBe(false);
	});

	test('negative chroma is achromatic', () => {
		expect(isAchromatic({ l: 0.5, c: -1, h: 0 })).toBe(true);
	});
});

describe('formatOklch', () => {
	describe.concurrent('syntax', () => {
		test('produces valid CSS oklch() string', () => {
			const s = formatOklch(hexToOklch('#ff0000'));
			expect(s).toMatch(/^oklch\(\d+(\.\d+)?% \d+(\.\d+)? (\d+(\.\d+)?|none)\)$/);
		});

		test('includes alpha with / separator', () => {
			const s = formatOklch(hexToOklch('#ff000080'));
			expect(s).toMatch(/^oklch\(\d+(\.\d+)?% \d+(\.\d+)? (\d+(\.\d+)?|none) \/ \d+(\.\d+)?\)$/);
		});

		test('known outputs', () => {
			expect(formatOklch(hexToOklch('#000000'))).toBe('oklch(0% 0 none)');
			expect(formatOklch(hexToOklch('#ffffff'))).toBe('oklch(100% 0 none)');
			expect(formatOklch(hexToOklch('#ff0000'))).toBe('oklch(62.8% 0.2577 29.23)');
			expect(formatOklch(hexToOklch('#ff000080'))).toBe('oklch(62.8% 0.2577 29.23 / 0.502)');
		});

		test('achromatic uses CSS none keyword for hue', () => {
			expect(formatOklch(hexToOklch('#808080'))).toBe('oklch(59.99% 0 none)');
			expect(formatOklch(hexToOklch('#000000'))).toBe('oklch(0% 0 none)');
			expect(formatOklch(hexToOklch('#ffffff'))).toBe('oklch(100% 0 none)');
		});

		test('strict epsilon keeps numeric hue for tiny chroma above 4e-6', () => {
			expect(formatOklch({ l: 0.5, c: 5e-5, h: 210 })).toBe('oklch(50% 0.0001 210)');
		});
	});

	describe.concurrent('clamping', () => {
		test('clamps out-of-range values', () => {
			// Negative chroma is achromatic → hue becomes none
			expect(formatOklch({ l: -0.5, c: -1, h: 400 })).toBe('oklch(0% 0 none)');
			expect(formatOklch({ l: 2, c: 0.5, h: -30 })).toBe('oklch(100% 0.5 330)');
		});

		test('normalizes hue 360 to 0', () => {
			expect(formatOklch({ l: 0.5, c: 0.1, h: 360 })).toBe('oklch(50% 0.1 0)');
			expect(formatOklch({ l: 0.5, c: 0.1, h: 720 })).toBe('oklch(50% 0.1 0)');
		});

		test('clamps alpha to [0, 1]', () => {
			expect(formatOklch({ l: 0.5, c: 0.1, h: 30, a: -1 })).toBe('oklch(50% 0.1 30 / 0)');
			expect(formatOklch({ l: 0.5, c: 0.1, h: 30, a: 2 })).toBe('oklch(50% 0.1 30 / 1)');
		});
	});

	describe.concurrent('edge cases', () => {
		test('no scientific notation for tiny values', () => {
			const s = formatOklch({ l: 0.000001, c: 0.000001, h: 0.000001 });
			expect(s).not.toMatch(/\de[+-]?\d/);
			expect(s).toBe('oklch(0% 0 none)');
		});

		test('no -0 in formatted string', () => {
			const s = formatOklch({ l: -0, c: -0, h: -0 });
			expect(s).not.toContain('-0');
			expect(s).toBe('oklch(0% 0 none)');
		});

		test('consistent precision', () => {
			// L%: up to 2 decimals, C: up to 4 decimals, H: up to 2 decimals
			const s = formatOklch(hexToOklch('#bada55'));
			const match = s.match(/^oklch\((.+)% (.+) (.+)\)$/);
			expect(match).not.toBeNull();
			if (match) {
				const [, lStr, cStr, hStr] = match;
				// Check no excessive decimals
				expect((lStr ?? '').split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
				expect((cStr ?? '').split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
				expect((hStr ?? '').split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
			}
		});
	});
});
