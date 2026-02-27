import { defineConfig } from 'tsdown';

export default defineConfig([{
	entry: { lib: 'src/lib.ts' },
	format: ['esm'],
	dts: true,
	unbundle: false,
}, {
	entry: { 'hex-to-oklch': 'src/bin.ts' },
	format: ['esm'],
	treeshake: true,
	unbundle: true,
	dts: false,
	banner: '#!/usr/bin/env node',
}]);
