# hex-to-oklch

Tiny, zero-dependency hex-to-[OKLCH] converter. Library + CLI.

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

```ts
import { formatOklch, hexToOklch } from 'hex-to-oklch';
```

### `hexToOklch(hex: string): Oklch`

Convert a hex color to OKLCH. Accepts `#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA`.\
The `#` prefix is optional. Alpha is preserved as `a` when present in input.

Throws on invalid input.

```ts
hexToOklch('#ff0000');
// { l: 0.6279..., c: 0.2577..., h: 29.23... }

hexToOklch('#ff000080');
// { l: 0.6279..., c: 0.2577..., h: 29.23..., a: 0.5019... }
```

### `formatOklch(oklch: Oklch): string`

Format an `Oklch` value as a CSS `oklch()` string. Values are clamped to valid ranges. If `a` is present, formatter emits `oklch(... / a)`.

```ts
formatOklch(hexToOklch('#ff0000'));
// 'oklch(62.8% 0.2577 29.23)'

formatOklch(hexToOklch('#ff000080'));
// 'oklch(62.8% 0.2577 29.23 / 0.502)'
```

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
