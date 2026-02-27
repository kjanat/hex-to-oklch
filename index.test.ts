import { expect, test } from 'bun:test';
import { formatOklch, hexToOklch } from './index.ts';

const TOLERANCE = 0.005;

function near(a: number, b: number): void {
	expect(Math.abs(a - b)).toBeLessThan(TOLERANCE);
}

// --- conversion correctness ---

test('black', () => {
	const { l, c } = hexToOklch('#000000');
	near(l, 0);
	near(c, 0);
});

test('white', () => {
	const { l, c } = hexToOklch('#ffffff');
	near(l, 1);
	near(c, 0);
});

test('red', () => {
	const { l, c, h } = hexToOklch('#ff0000');
	near(l, 0.6279);
	near(c, 0.2577);
	near(h, 29.23);
});

test('green', () => {
	const { l, c, h } = hexToOklch('#00ff00');
	near(l, 0.8664);
	near(c, 0.2948);
	near(h, 142.5);
});

test('blue', () => {
	const { l, c, h } = hexToOklch('#0000ff');
	near(l, 0.4520);
	near(c, 0.3132);
	near(h, 264.05);
});

// --- hex parsing variants ---

test('3-digit hex', () => {
	const a = hexToOklch('#f00');
	const b = hexToOklch('#ff0000');
	near(a.l, b.l);
	near(a.c, b.c);
	near(a.h, b.h);
});

test('8-digit hex (alpha ignored)', () => {
	const a = hexToOklch('#ff000080');
	const b = hexToOklch('#ff0000');
	near(a.l, b.l);
	near(a.c, b.c);
	near(a.h, b.h);
});

test('4-digit hex (alpha ignored)', () => {
	const a = hexToOklch('#f008');
	const b = hexToOklch('#ff0000');
	near(a.l, b.l);
	near(a.c, b.c);
	near(a.h, b.h);
});

test('no hash prefix', () => {
	const a = hexToOklch('ff0000');
	const b = hexToOklch('#ff0000');
	near(a.l, b.l);
});

test('invalid hex throws', () => {
	expect(() => hexToOklch('#xyz')).toThrow('Invalid hex color');
	expect(() => hexToOklch('#12')).toThrow('Invalid hex color');
	expect(() => hexToOklch('')).toThrow('Invalid hex color');
});

// --- formatOklch ---

test('formatOklch produces valid CSS', () => {
	const s = formatOklch(hexToOklch('#ff0000'));
	expect(s).toMatch(/^oklch\(\d+(\.\d+)?% \d+(\.\d+)? \d+(\.\d+)?\)$/);
});

test('formatOklch black', () => {
	expect(formatOklch(hexToOklch('#000000'))).toBe('oklch(0% 0 0)');
});
