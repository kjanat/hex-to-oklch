# hex-to-oklch

[![NPM Version](https://img.shields.io/npm/v/hex-to-oklch?logo=npm&labelColor=CB3837&color=black)](https://www.npmjs.com/package/hex-to-oklch)

Tiny, zero-dependency hex color to [OKLCH] converter. Library + CLI.

Works with Node.js, Bun, Deno, and any ESM-compatible runtime.

## Install

```sh
npm install hex-to-oklch
```

## CLI

```sh
npx hex-to-oklch '#ff6600'
# oklch(69.58% 0.2043 43.49)
```

## API

<!-- dprint-ignore-start -->

```ts
import {
	ACHROMATIC_CHROMA_THRESHOLD,
	formatOklch,
	hexToOklch,
	isAchromatic,
} from 'hex-to-oklch';
```
<!-- dprint-ignore-end -->

### `hexToOklch(hex: string, options?: HexToOklchOptions): Oklch`

Convert a hex color to OKLCH. Accepts `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`.\
The `#` prefix is optional. Alpha is preserved as `a` when present in input
unless `options.alpha` changes behavior.

Throws on invalid input.

```ts
hexToOklch('#ff0000');
// { l: 0.6279..., c: 0.2577..., h: 29.23... }

hexToOklch('#ff000080');
// { l: 0.6279..., c: 0.2577..., h: 29.23..., a: 0.5019... }

hexToOklch('#ff000080', { alpha: 'discard' });
// { l: 0.6279..., c: 0.2577..., h: 29.23... }

hexToOklch('#ff000080', { alpha: 'override', value: 0.25 });
// { l: 0.6279..., c: 0.2577..., h: 29.23..., a: 0.25 }

hexToOklch('#808080');
// { l: 0.5999..., c: ~0, h: 0 } // achromatic
```

```ts
type HexToOklchOptions =
	| { readonly alpha?: 'preserve' } // default
	| { readonly alpha: 'discard' }
	| { readonly alpha: 'override'; readonly value: number }; // clamped to 0..1
```

### `formatOklch(oklch: Oklch): string`

Format an `Oklch` value as a CSS `oklch()` string.

- Values are clamped to valid ranges.
- If `a` is present, formatter emits `oklch(... / a)`.
- Achromatic colors emit CSS `none` for hue and `0` chroma.

```ts
formatOklch(hexToOklch('#ff0000'));
// 'oklch(62.8% 0.2577 29.23)'

formatOklch(hexToOklch('#808080'));
// 'oklch(59.99% 0 none)'

formatOklch(hexToOklch('#ff000080'));
// 'oklch(62.8% 0.2577 29.23 / 0.502)'
```

### `isAchromatic(oklch: Oklch): boolean`

Return `true` when `oklch.c <= ACHROMATIC_CHROMA_THRESHOLD`.

```ts
isAchromatic(hexToOklch('#808080'));
// true

isAchromatic(hexToOklch('#808081'));
// false
```

### `ACHROMATIC_CHROMA_THRESHOLD`

```ts
const ACHROMATIC_CHROMA_THRESHOLD = 4e-6;
```

Powerless-hue epsilon used for achromatic checks in this library.
See [CSS Color 4 §4.4.1].

### `Oklch`

```ts
type Oklch = {
	readonly l: number; // Lightness  (0-1)
	readonly c: number; // Chroma     (0+)
	readonly h: number; // Hue        (0-360, 0 for achromatic)
	readonly a?: number; // Alpha      (0-1, only when provided in input)
};
```

[OKLCH]: https://bottosson.github.io/posts/oklab/
[CSS Color 4 §4.4.1]: https://www.w3.org/TR/css-color-4/#powerless

<!--markdownlint-disable-file no-hard-tabs-->
