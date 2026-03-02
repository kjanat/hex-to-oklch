# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog], and this project adheres to [Semantic Versioning].

## [Unreleased]

### Added

- CI runtime-compat workflow: smoke-tests the packed tarball on Node, Bun, and Deno to verify the README's runtime claims.

### Changed

- Publish workflow: strict tag pattern, `bun i -g npm`, rely on `prepublishOnly` for test+typecheck gate

## [3.1.0] - 2026-02-28

### Added

- Add `CHANGELOG.md` using Keep a Changelog format with retroactive release entries.
- Add a new CLI implementation in `src/cli.ts` with `--alpha`, `--help`, `--version`, stdin input via `-`, and multi-input conversion.
- Add package quality checks with `@arethetypeswrong/core`, `publint`, and `unplugin-unused` in the build pipeline.
- Add runtime metadata via `engines` and a Volta Node pin.
- Add continuous preview releases via [pkg.pr.new] on every branch push. Install a preview build
  directly from a commit SHA without waiting for a release:
  ```sh
  # library
  npm i https://pkg.pr.new/hex-to-oklch@<sha>
  # CLI (run directly with npx)
  npx https://pkg.pr.new/hex-to-oklch@<sha> '#ff6600'
  ```

### Changed

- Update package exports to `dist/index.mjs`, expose `./package.json`, and mark the package as `sideEffects: false`.
- Rework build scripts and `tsdown` config to inject revision metadata and split library and CLI output targets.
- Publish only `dist` artifacts and move CLI source from `src/bin.ts` to `src/cli.ts`.
- Enable isolated declaration output settings and add `pkg` path alias support in `tsconfig.json`.
- Refresh README wording for project description and supported hex format order.
- Enable full minification for both build outputs; `dist/index.mjs` 6.9 kB → 1.8 kB, `dist/hex-to-oklch.mjs` 4.3 kB → 3.0 kB. TypeScript consumers are unaffected — types and JSDoc remain in `dist/index.d.mts`.

### Fixed

- Fix CLI hanging when `-` (stdin) is passed multiple times by reading stdin once and reusing.
- Fix `bd:watch` script missing git-revision fallback, matching the pattern used by other scripts.
- Fix duplicate period in `src/lib.ts` module doc comment.

### Removed

- Remove the legacy `src/bin.ts` CLI entrypoint.

## [3.0.0] - 2026-02-27

### Changed

- Align achromatic detection with CSS Color 4 by setting powerless-hue epsilon to `4e-6` and making the threshold inclusive (`<=`).
- Update `isAchromatic` and `formatOklch` behavior and tests for strict epsilon handling.
- Move publish build work into `prepack`, replace deprecated `prepublish` with `prepublishOnly`, and simplify tarball output wiring in CI.

### Fixed

- Fix GitHub Actions tarball-output handling to avoid newline and command-substitution edge cases.

## [2.0.0] - 2026-02-27

### Added

- Add exported `ACHROMATIC_CHROMA_THRESHOLD` and `isAchromatic(oklch)`.
- Add achromatic and formatter test coverage for powerless-hue behavior.

### Changed

- Treat near-gray colors as achromatic in conversion by zeroing hue at the achromatic threshold.
- Emit spec-correct CSS `none` hue for achromatic `oklch()` formatting.

## [1.0.1] - 2026-02-27

### Added

- Add npm version badge to `README.md`.

### Changed

- Restructure tests and improve package ergonomics.

## [1.0.0] - 2026-02-27

### Added

- Promote first stable `1.0.0` release.
- Add TypeScript dependency needed for `tsdown` declaration builds.

## [1.0.0-rc.0] - 2026-02-27

### Added

- Initial `hex-to-oklch` library and CLI for `#RGB`, `#RRGGBB`, `#RGBA`, and `#RRGGBBAA` to OKLCH conversion.
- Preserve alpha from input with `discard` and `override` options.
- Add runtime-agnostic packaging and `tsdown`-based build pipeline.
- Add README API docs, JSDoc improvements, expanded tests, and project licensing.

[Unreleased]: https://github.com/kjanat/hex-to-oklch/compare/v3.1.0...HEAD
[3.1.0]: https://github.com/kjanat/hex-to-oklch/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/kjanat/hex-to-oklch/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/kjanat/hex-to-oklch/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/kjanat/hex-to-oklch/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/kjanat/hex-to-oklch/compare/v1.0.0-rc.0...v1.0.0
[1.0.0-rc.0]: https://github.com/kjanat/hex-to-oklch/releases/tag/v1.0.0-rc.0
[pkg.pr.new]: https://pkg.pr.new
[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/
[Semantic Versioning]: https://semver.org/spec/v2.0.0.html

<!-- markdownlint-disable-file no-duplicate-heading -->
