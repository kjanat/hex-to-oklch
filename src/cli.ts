import { formatOklch, hexToOklch, type HexToOklchOptions } from 'hex-to-oklch';
import { createInterface } from 'node:readline';
import { bin, name, version } from 'pkg';

function firstKey<T extends Record<string, unknown>>(obj: T): string | undefined {
	return Object.keys(obj)[0];
}

const commandName = firstKey(bin) ?? name;

const USAGE = `Usage: ${commandName} [options] <hex|->...`;
const HELP_DETAILS = `\
Convert one or more hex colors to OKLCH.
Pass \`-\` to read hex values from stdin, one per line.

Arguments:
  <hex>    #RGB, #RGBA, #RRGGBB, or #RRGGBBAA
           (\`#\` optional)

Options:
  --alpha <strategy>    Alpha handling (default: preserve)
                          preserve   keep alpha from input
                          discard    strip alpha channel
                          <0–1>      override with fixed value
  -V, --version         Print version and exit
  -h, --help            Print this help and exit

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
  # oklch(69.58% 0.2043 43.49)`;

type ParseResult =
	| { kind: 'help' }
	| { kind: 'version' }
	| { kind: 'run'; inputs: string[]; options: HexToOklchOptions };

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

	if (inputs.length === 0) throw new CliInputError('missing <hex>', true);
	return { kind: 'run', inputs, options };
}

async function printHelp(): Promise<void> {
	const revision = await resolveRevision();
	console.log(buildHelpText(revision));
}

async function runInputs(inputs: string[], options: HexToOklchOptions): Promise<boolean> {
	let ok = true;
	for (const input of inputs) {
		if (input === '-') {
			for (const hex of await readStdin()) {
				if (!convert(hex, options)) ok = false;
			}
			continue;
		}

		if (!convert(input, options)) ok = false;
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
