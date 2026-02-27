import { describe, expect, test } from 'bun:test';
import type { Oklch } from './lib.ts';
import { formatOklch, hexToOklch } from './lib.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 1. Parsing & normalization
// ---------------------------------------------------------------------------

describe('parsing', () => {
	test('#RRGGBB', () => {
		const o = hexToOklch('#ff0000');
		expect(o.l).toBeGreaterThan(0);
	});

	test('#RGB expands via digit duplication', () => {
		expectOklchClose(hexToOklch('#f00'), hexToOklch('#ff0000'));
		expectOklchClose(hexToOklch('#123'), hexToOklch('#112233'));
	});

	test('#RRGGBBAA — alpha discarded', () => {
		expectOklchClose(hexToOklch('#ff000000'), hexToOklch('#ff0000'));
		expectOklchClose(hexToOklch('#ff000080'), hexToOklch('#ff0000'));
		expectOklchClose(hexToOklch('#ff0000ff'), hexToOklch('#ff0000'));
	});

	test('#RGBA — alpha discarded', () => {
		expectOklchClose(hexToOklch('#f000'), hexToOklch('#ff0000'));
		expectOklchClose(hexToOklch('#f008'), hexToOklch('#ff0000'));
		expectOklchClose(hexToOklch('#f00f'), hexToOklch('#ff0000'));
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

	test('invalid inputs throw', () => {
		// Wrong length
		expect(() => hexToOklch('#ff')).toThrow('Invalid hex color');
		expect(() => hexToOklch('#fffff')).toThrow('Invalid hex color');
		expect(() => hexToOklch('#fffffffff')).toThrow('Invalid hex color');
		// Non-hex chars
		expect(() => hexToOklch('#ggg')).toThrow('Invalid hex color');
		expect(() => hexToOklch('#12xz89')).toThrow('Invalid hex color');
		// Empty / bare hash
		expect(() => hexToOklch('')).toThrow('Invalid hex color');
		expect(() => hexToOklch('#')).toThrow('Invalid hex color');
	});

	test('does not accept 0x prefix', () => {
		expect(() => hexToOklch('0xFFAA00')).toThrow('Invalid hex color');
	});
});

// ---------------------------------------------------------------------------
// 2. Golden vectors (cross-validated against culori 4.0.2)
// ---------------------------------------------------------------------------

describe('golden vectors', () => {
	// Reference values computed independently and verified against culori 4.0.2.
	// Tolerance: L ±5e-4, C ±5e-4, H ±0.01°

	test('black #000000', () => {
		expectOklchClose(hexToOklch('#000000'), { l: 0, c: 0, h: 0 });
	});

	test('white #ffffff', () => {
		expectOklchClose(hexToOklch('#ffffff'), { l: 1, c: 0, h: 0 });
	});

	// --- primaries ---

	test('red #ff0000', () => {
		expectOklchClose(hexToOklch('#ff0000'), { l: 0.62796, c: 0.25768, h: 29.2339 });
	});

	test('green #00ff00', () => {
		expectOklchClose(hexToOklch('#00ff00'), { l: 0.86644, c: 0.29483, h: 142.4953 });
	});

	test('blue #0000ff', () => {
		expectOklchClose(hexToOklch('#0000ff'), { l: 0.45201, c: 0.31321, h: 264.052 });
	});

	// --- secondaries ---

	test('yellow #ffff00', () => {
		expectOklchClose(hexToOklch('#ffff00'), { l: 0.96798, c: 0.21101, h: 109.7692 });
	});

	test('cyan #00ffff', () => {
		expectOklchClose(hexToOklch('#00ffff'), { l: 0.9054, c: 0.15455, h: 194.769 });
	});

	test('magenta #ff00ff', () => {
		expectOklchClose(hexToOklch('#ff00ff'), { l: 0.70167, c: 0.32249, h: 328.3634 });
	});

	// --- grays ---

	test('mid-gray #808080', () => {
		expectOklchClose(hexToOklch('#808080'), { l: 0.59987, c: 0, h: 0 });
	});

	test('dark-gray #777777', () => {
		expectOklchClose(hexToOklch('#777777'), { l: 0.56926, c: 0, h: 0 });
	});

	test('near-black #010101', () => {
		expectOklchClose(hexToOklch('#010101'), { l: 0.0672, c: 0, h: 0 });
	});

	// --- real-world colors ---

	test('#bada55', () => {
		expectOklchClose(hexToOklch('#bada55'), { l: 0.83912, c: 0.16217, h: 121.448 });
	});

	test('#c0ffee', () => {
		expectOklchClose(hexToOklch('#c0ffee'), { l: 0.95302, c: 0.06711, h: 176.357 });
	});

	test('rebeccapurple #663399', () => {
		expectOklchClose(hexToOklch('#663399'), { l: 0.44027, c: 0.1603, h: 303.373 });
	});
});

// ---------------------------------------------------------------------------
// 3. Achromatic behavior
// ---------------------------------------------------------------------------

describe('achromatic', () => {
	// CSS Color 4 §12.1: hue is "powerless" when chroma ≈ 0.
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

// ---------------------------------------------------------------------------
// 4. Property invariants
// ---------------------------------------------------------------------------

describe('invariants', () => {
	// Batch of diverse colors for property checks
	const SAMPLE_HEXES = [
		'#000000',
		'#ffffff',
		'#808080',
		'#ff0000',
		'#00ff00',
		'#0000ff',
		'#ffff00',
		'#00ffff',
		'#ff00ff',
		'#010101',
		'#fefefe',
		'#123456',
		'#abcdef',
		'#fedcba',
		'#c0ffee',
		'#bada55',
		'#663399',
		'#deface',
		'#7f7f7f',
		'#010100',
		'#000100',
		'#100000',
		'#000001',
		'#080808',
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
	});
});

// ---------------------------------------------------------------------------
// 5. formatOklch
// ---------------------------------------------------------------------------

describe('formatOklch', () => {
	test('produces valid CSS oklch() syntax', () => {
		const s = formatOklch(hexToOklch('#ff0000'));
		expect(s).toMatch(/^oklch\(\d+(\.\d+)?% \d+(\.\d+)? \d+(\.\d+)?\)$/);
	});

	test('known outputs', () => {
		expect(formatOklch(hexToOklch('#000000'))).toBe('oklch(0% 0 0)');
		expect(formatOklch(hexToOklch('#ffffff'))).toBe('oklch(100% 0 0)');
		expect(formatOklch(hexToOklch('#ff0000'))).toBe('oklch(62.8% 0.2577 29.23)');
	});

	test('clamps out-of-range values', () => {
		expect(formatOklch({ l: -0.5, c: -1, h: 400 })).toBe('oklch(0% 0 40)');
		expect(formatOklch({ l: 2, c: 0.5, h: -30 })).toBe('oklch(100% 0.5 330)');
	});

	test('normalizes hue 360 to 0', () => {
		expect(formatOklch({ l: 0.5, c: 0.1, h: 360 })).toBe('oklch(50% 0.1 0)');
		expect(formatOklch({ l: 0.5, c: 0.1, h: 720 })).toBe('oklch(50% 0.1 0)');
	});

	test('no scientific notation for tiny values', () => {
		const s = formatOklch({ l: 0.000001, c: 0.000001, h: 0.000001 });
		expect(s.includes('e')).toBe(false);
		expect(s).toBe('oklch(0% 0 0)');
	});

	test('no -0 in formatted string', () => {
		const s = formatOklch({ l: -0, c: -0, h: -0 });
		expect(s.includes('-0')).toBe(false);
		expect(s).toBe('oklch(0% 0 0)');
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
