import { formatOklch, hexToOklch } from './index.ts';

const input = process.argv[2];

if (input === undefined) {
	console.error('Usage: hex-to-oklch <hex>');
	process.exit(1);
}

try {
	console.log(formatOklch(hexToOklch(input)));
} catch (e) {
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(1);
}
