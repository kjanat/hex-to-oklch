import { formatOklch, hexToOklch, type HexToOklchOptions, oklchToHex, type Oklch } from 'hex-to-oklch';
import { createInterface } from 'node:readline';
import { bin, name, version } from 'pkg';

function firstKey<T extends Record<string, unknown>>(obj: T): string | undefined {
	return Object.keys(obj)[0];
}

const commandName = firstKey(bin) ?? name;

const USAGE = `Usage: ${commandName} [options] <hex|oklch|->...`;
const HELP_DETAILS = `\
Convert one or more hex colors to OKLCH, or OKLCH back to hex.
Pass \`-\` to read values from stdin, one per line.

Arguments:
  <hex>      #RGB, #RGBA, #RRGGBB, or #RRGGBBAA
             (\`#\` optional)
  <oklch>    CSS oklch() string (with --to-hex)

Options:
  --to-hex                Convert OKLCH to hex (reverse mode)
  --alpha <strategy>      Alpha handling (default: preserve)
                            preserve   keep alpha from input
                            discard    strip alpha channel
                            <0–1>      override with fixed value
  -V, --version           Print version and exit
  -h, --help              Print this help and exit

Examples:
  hex-to-oklch '#ff6600'
  # oklch(69.58% 0.2043 43.49)

  hex-to-oklch ff6600 fff 000
  # oklch(69.58% 0.2043 43.49)
  # oklch(100% 0 none)
  # oklch(0% 0 none)

  hex-to-oklch --alpha discard '#ff660080'
  # oklch(69.58% 0.2043 43.49)

  hex-to-oklch --alpha 0.5 '#ff6600'
  # oklch(69.58% 0.2043 43.49 / 0.5)

  echo '#ff6600' | hex-to-oklch -
  # oklch(69.58% 0.2043 43.49)

  hex-to-oklch --to-hex 'oklch(69.58% 0.2043 43.49)'
  # #ff6600

  hex-to-oklch --to-hex 'oklch(62.8% 0.2577 29.23 / 0.502)'
  # #ff000080`;

type ParseResult =
	| { kind: 'help' }
	| { kind: 'version' }
	| { kind: 'run'; inputs: string[]; options: HexToOklchOptions }
	| { kind: 'to-hex'; inputs: string[] };

class CliInputError extends Error {
	constructor(
		message: string,
		public readonly showUsage: boolean = false,
	) {
		super(message);
	}
}

async function resolveRevision(): Promise<string> {
	if (process.env.REVISION) return process.env.REVISION;

	try {
		return `${(await Bun.$`git rev-parse --short HEAD`.text()).trim()}+dirty`;
	} catch {
		return 'dev';
	}
}

function buildHelpText(revision: string): string {
	return `${commandName} v${version}  (rev: ${revision})
${USAGE}

${HELP_DETAILS}`;
}

function parseArgs(argv: string[]): ParseResult {
	let options: HexToOklchOptions = {};
	let toHex = false;
	const inputs: string[] = [];

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === undefined) continue;

		switch (arg) {
			case '--help':
			case '-h':
				return { kind: 'help' };
			case '--version':
			case '-V':
				return { kind: 'version' };
			case '--to-hex':
				toHex = true;
				continue;
			case '--alpha': {
				const value = argv[++i];
				if (value === undefined) throw new CliInputError('--alpha requires a value');
				try {
					options = parseAlpha(value);
				} catch (e) {
					throw new CliInputError(e instanceof Error ? e.message : String(e));
				}
				continue;
			}
			default:
				if (arg.startsWith('-') && arg !== '-') {
					throw new CliInputError(`unknown option: ${arg}`);
				}
				inputs.push(arg);
		}
	}

	if (inputs.length === 0) {
		throw new CliInputError(toHex ? 'missing <oklch>' : 'missing <hex>', true);
	}

	if (toHex) return { kind: 'to-hex', inputs };
	return { kind: 'run', inputs, options };
}

async function printHelp(): Promise<void> {
	const revision = await resolveRevision();
	console.log(buildHelpText(revision));
}

/**
 * Parse a CSS `oklch()` string into an {@link Oklch} object.
 *
 * Accepts formats like:
 * - `oklch(62.8% 0.2577 29.23)`
 * - `oklch(62.8% 0.2577 29.23 / 0.5)`
 * - `oklch(50% 0 none)`
 *
 * @param input - CSS oklch() string.
 * @returns Parsed OKLCH color.
 * @throws {Error} If the string is not a valid oklch() expression.
 */
export function parseOklchString(input: string): Oklch {
	const s = input.trim();
	const match = s.match(
		/^oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+(none|[0-9.]+)(?:\s*\/\s*([0-9.]+))?\s*\)$/,
	);
	if (!match) {
		throw new Error(`Invalid oklch() string: ${input}`);
	}

	const l = parseFloat(match[1]!) / 100;
	const c = parseFloat(match[2]!);
	const h = match[3] === 'none' ? 0 : parseFloat(match[3]!);

	if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) {
		throw new Error(`Invalid oklch() values: ${input}`);
	}

	if (match[4] !== undefined) {
		const a = parseFloat(match[4]);
		if (!Number.isFinite(a)) {
			throw new Error(`Invalid oklch() alpha: ${input}`);
		}
		return { l, c, h, a };
	}

	return { l, c, h };
}

function convertToHex(input: string): boolean {
	try {
		const oklch = parseOklchString(input);
		console.log(oklchToHex(oklch));
		return true;
	} catch (e) {
		console.error(e instanceof Error ? e.message : String(e));
		return false;
	}
}

async function runInputs(inputs: string[], options: HexToOklchOptions): Promise<boolean> {
	let ok = true;
	let stdinLines: string[] | undefined;
	for (const input of inputs) {
		if (input === '-') {
			stdinLines ??= await readStdin();
			for (const hex of stdinLines) {
				if (!convert(hex, options)) ok = false;
			}
			continue;
		}

		if (!convert(input, options)) ok = false;
	}
	return ok;
}

async function runToHex(inputs: string[]): Promise<boolean> {
	let ok = true;
	let stdinLines: string[] | undefined;
	for (const input of inputs) {
		if (input === '-') {
			stdinLines ??= await readStdin();
			for (const line of stdinLines) {
				if (!convertToHex(line)) ok = false;
			}
			continue;
		}

		if (!convertToHex(input)) ok = false;
	}
	return ok;
}

async function main(argv: string[]): Promise<number> {
	try {
		const parsed = parseArgs(argv);
		if (parsed.kind === 'help') {
			await printHelp();
			return 0;
		}

		if (parsed.kind === 'version') {
			console.log(version);
			return 0;
		}

		if (parsed.kind === 'to-hex') {
			const ok = await runToHex(parsed.inputs);
			return ok ? 0 : 1;
		}

		const ok = await runInputs(parsed.inputs, parsed.options);
		return ok ? 0 : 1;
	} catch (e) {
		if (e instanceof CliInputError) {
			console.error(`error: ${e.message}`);
			if (e.showUsage) console.error(USAGE);
			return 1;
		}

		console.error(e instanceof Error ? e.message : String(e));
		return 1;
	}
}

if (import.meta.main) {
	process.exit(await main(process.argv.slice(2)));
}

export function parseAlpha(raw: string): HexToOklchOptions {
	if (raw === 'preserve') return {};
	if (raw === 'discard') return { alpha: 'discard' };
	const n = Number(raw);
	if (!Number.isNaN(n)) return { alpha: 'override', value: n };
	throw new Error(`invalid --alpha value: ${JSON.stringify(raw)}`);
}

export function convert(hex: string, options: HexToOklchOptions): boolean {
	try {
		console.log(formatOklch(hexToOklch(hex, options)));
		return true;
	} catch (e) {
		console.error(e instanceof Error ? e.message : String(e));
		return false;
	}
}

export async function readStdin(): Promise<string[]> {
	const rl = createInterface({ input: process.stdin, terminal: false });
	const lines: string[] = [];
	for await (const line of rl) {
		const hex = line.trim();
		if (hex) lines.push(hex);
	}
	return lines;
}
