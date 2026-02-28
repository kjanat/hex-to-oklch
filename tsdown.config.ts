import { defineConfig, type UserConfig, type UserConfigExport } from 'tsdown';

const REVISION = process.env.REVISION ?? 'dev';

const shared = {
	format: 'esm' as const,
	define: { 'process.env.REVISION': JSON.stringify(REVISION) },
	clean: true,
	fixedExtension: true,
};

const config: UserConfigExport = defineConfig((): UserConfig[] => [
	{
		...shared,
		entry: { index: 'src/lib.ts' },
		platform: 'neutral',
		exports: true,
		dts: { enabled: true, newContext: true, sideEffects: false },
		attw: { profile: 'esm-only' },
		publint: true,
		unused: true,
		minify: true,
	},
	{
		...shared,
		entry: { 'hex-to-oklch': 'src/cli.ts' },
		platform: 'node',
		deps: { neverBundle: ['hex-to-oklch', /[\\/]src[\\/]lib\.ts$/] },
		dts: false,
		banner: { js: '#!/usr/bin/env node' },
		minify: true,
	},
]);

export default config;
