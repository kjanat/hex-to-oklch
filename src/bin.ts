import { formatOklch, hexToOklch } from './lib.ts';

const input = process.argv[2];

if (input === undefined || input === '--help' || input === '-h') {
	console.log('Usage: hex-to-oklch <hex>');
	process.exit(input === undefined ? 1 : 0);
}

try {
	console.log(formatOklch(hexToOklch(input)));
} catch (e) {
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(1);
}
