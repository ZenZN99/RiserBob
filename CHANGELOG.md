# Changelog

All notable changes to **RiserBob** are documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For complete release details, implementation notes, examples, and upgrade instructions, see [RELEASE.md](./RELEASE.md).

---

## [1.2.0] - Unreleased

<Badge>Upcoming Release</Badge>

### Added

- Added dedicated HTTP error handling with specific exception classes, including `SpongNotFoundException`.
- Added `spongGroup()` for organizing routes into route groups.
- Added support for nested route groups.
- Added a `service` file to the generated bootstrap project structure.
- Added a `modules.ts` file to the generated bootstrap project structure.
- Added an interactive CLI prompt that allows developers to choose whether to generate a service when creating a module.

### Improved

- Significantly strengthened the validation system with stricter rule compatibility and validation behavior.
- Improved validation schema constraints to prevent invalid rule combinations.
- Improved CLI project and module generation workflows.
- Improved generated project architecture and file organization.
- Improved the Prettier configuration (`.prettierrc`) for a more consistent development experience.

### Performance & Monitoring

- Improved performance testing and evaluation workflows.
- Added performance monitoring under load to help analyze framework behavior during intensive requests.
- Added memory usage monitoring to help observe memory consumption during testing.
- Improved the ability to evaluate framework stability and resource usage under different workloads.

### Developer Experience

- Improved the generated bootstrap structure with clearer separation between modules and services.
- Made module generation more flexible through interactive CLI configuration.
- Improved code formatting consistency in generated projects.

---

## [1.1.0] - 2026-10-30

### Added

- Expanded the validation system with `array`, `minItems`, and `maxItems` rules.
- Added URL validation using the `url` rule.
- Added enum validation using `enum:value1,value2,...`.
- Added the `create-riser-bob` project generator.
- Added Socket.IO integration through `@socket.io/bun-engine`.
- Added `spongSocketIO()` for configuring Socket.IO.
- Added improved module scaffolding through the CLI.
- Added starter validation files for Create and Update operations.
- Added a Prettier configuration to the generated project template.

### Improved

- Improved TypeScript validation schema typing and rule compatibility checks.
- Improved runtime validation for arrays, URLs, and enum values.
- Improved authentication middleware configuration for cookie-based authentication.
- Improved CLI project creation and generated module structure.
- Improved developer experience and framework configuration.
- Improved HTTP framework performance, increasing benchmark results from approximately **37,000 requests per second to more than 52,000 requests per second**.

### Changed

- Cookie-based authentication now requires an explicit `cookieName` when using `mode: 'cookie'`.
- Improved validation rule ordering and restrictions on incompatible combinations.
- Updated generated project configuration and setup workflow.

### Performance

- Increased benchmark throughput from approximately 37K requests/second to more than 52K requests/second.
- Represents an improvement of approximately 40% over the previous benchmark result.

### Documentation

- Expanded documentation for validation, authentication, CLI workflows, and Socket.IO integration.
- Added release documentation and usage examples.

**[Read the RiserBob v1.1.0 Release Notes →](./RELEASE.md)**

---

## [1.0.0] - 2026-10-22

### Added

- Initial stable release of RiserBob.
- TypeScript-first backend development experience powered by Bun.
- Core HTTP framework functionality.
- Framework components and developer tooling.
- Modular development structure.
- Developer-friendly error messages with RiserBob's unique personality.
- Initial project documentation and setup instructions.

### Notes

- RiserBob reaches its first stable release.
- Established the `1.0.0` baseline for future development.

**[View v1.0.0 on GitHub](https://github.com/ZenZN99/RiserBob/releases/tag/v1.0.0)**

---

## Release History

| Version                                                          | Date       | Highlights                                                                                                                 |
| ---------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1.2.0                                                            | Unreleased | Error handling, nested route groups, stricter validation, CLI improvements, performance and memory monitoring.             |
| [1.1.0](./RELEASE.md)                                            | 2026-10-30 | Validation improvements, authentication configuration, CLI generator, Socket.IO integration, and performance improvements. |
| [1.0.0](https://github.com/ZenZN99/RiserBob/releases/tag/v1.0.0) | 2026-10-22 | Initial stable release.                                                                                                    |

---

## Stay Updated

To discover the latest RiserBob features, improvements, and changes:

- **[RELEASE.md](./RELEASE.md)** — Complete details about the latest release.

---

**Build APIs. Stay in the Sponge Zone!** 🧽🍍
