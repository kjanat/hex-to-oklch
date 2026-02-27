# hex-to-oklch

Tiny, zero-dependency hex-to-[OKLCH](https://bottosson.github.io/posts/oklab/) converter. Library + CLI.

## Install

```sh
bun install hex-to-oklch
```

## CLI

```sh
bunx hex-to-oklch '#ff6600'
# oklch(69.58% 0.2043 43.49)
```

## API

```ts
import { formatOklch, hexToOklch } from 'hex-to-oklch';
```

### `hexToOklch(hex: string): Oklch`

Convert a hex color to OKLCH. Accepts `#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA` (alpha is discarded). The `#` prefix is optional.

Throws on invalid input.

```ts
hexToOklch('#ff0000');
// { l: 0.6279..., c: 0.2577..., h: 29.23... }
```

### `formatOklch(oklch: Oklch): string`

Format an `Oklch` value as a CSS `oklch()` string.

```ts
formatOklch(hexToOklch('#ff0000'));
// 'oklch(62.79% 0.2577 29.23)'
```

### `Oklch`

```ts
type Oklch = {
	readonly l: number; // Lightness  (0-1)
	readonly c: number; // Chroma     (0+)
	readonly h: number; // Hue        (0-360, 0 for achromatic)
};
```
