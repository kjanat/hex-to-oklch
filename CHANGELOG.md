# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog], and this project adheres to [Semantic Versioning].

## [Unreleased]

### Added

- Add `CHANGELOG.md` using Keep a Changelog format with retroactive release entries.

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

[Unreleased]: https://github.com/kjanat/hex-to-oklch/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/kjanat/hex-to-oklch/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/kjanat/hex-to-oklch/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/kjanat/hex-to-oklch/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/kjanat/hex-to-oklch/compare/v1.0.0-rc.0...v1.0.0
[1.0.0-rc.0]: https://github.com/kjanat/hex-to-oklch/releases/tag/v1.0.0-rc.0
[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/
[Semantic Versioning]: https://semver.org/spec/v2.0.0.html

<!-- markdownlint-disable-file no-duplicate-heading -->
