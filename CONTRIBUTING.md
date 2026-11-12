# Contributing to RiserBob

Thank you for your interest in improving RiserBob! This guide explains how to report issues, propose changes, and submit code.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating, and **read the [License and Contributions](#license-and-contributions) section carefully**. RiserBob is distributed under the MIT License, which allows open-source contributions and redistribution under its license terms.

## Ways to Contribute

- Report bugs and unexpected behavior.
- Suggest features or improvements.
- Improve documentation.
- Add or improve tests.
- Fix bugs or implement approved features.

## Reporting Bugs

Open a GitHub Issue and include:

- A clear title and description of the problem.
- Steps to reproduce it.
- Expected behavior vs. actual behavior.
- Your environment (OS, Bun version, RiserBob version).
- Relevant logs, error output, or a minimal code sample.

## Suggesting Features

Open an Issue describing the problem you want to solve, your proposed solution, and any alternatives you considered. **Please wait for maintainer feedback before starting work on a large change**, so your effort is not wasted.

## Development Setup

RiserBob uses [Bun](https://bun.sh).

```bash
# Install dependencies
bun install

# Run the full test suite
bun test
```

## Project Structure

```text
src/
  application/   Application class (RiserBob)
  errors/        HttpError and ErrorHandler
  http/          Response helpers
  middleware/    Middleware pipeline and built-in middleware
  routing/       Router
  server/        HTTP server
  types/         Shared types
  validation/    Validator
test/
  unit/          Unit tests, mirroring the src/ layout
  e2e/           End-to-end tests against a real server
```

## Coding Guidelines

- Write TypeScript with strict, explicit types. Avoid `any`.
- Follow the existing style: tabs for indentation, single quotes, no semicolons.
- Follow the existing naming conventions (for example, the `Spong` prefix for public API members).
- Keep functions small and focused, and prefer clear code over clever code.
- Do not introduce new dependencies without discussing them in an Issue first.
- Keep user-facing error messages consistent with the existing project tone.

## Testing Requirements

- Every bug fix must include a test that fails without the fix.
- Every new feature must include unit tests, and e2e tests where it affects server behavior.
- All tests must pass before you open a Pull Request:

```bash
bun test
```

- Tests that intentionally trigger errors should silence expected `console.error` / `console.warn` output with a spy, and restore it afterward.

## Commit Messages

Use short, descriptive messages in the imperative mood:

```text
Fix Allow header missing on 405 responses
Add maxLength rule to Validator
Update auth middleware to throw HttpError
```

## Pull Request Process

1. Make sure an Issue exists (or open one) and the maintainers have agreed on the approach.
2. Create a branch from `main` with a descriptive name (for example, `fix/405-allow-header`).
3. Make your changes, keeping each Pull Request focused on one concern.
4. Run `bun test` and confirm everything passes.
5. Open a Pull Request describing **what** changed and **why**, and link the related Issue.
6. Respond to review feedback respectfully. Maintainers may request changes or decline contributions that do not fit the project's goals.

## License and Contributions

RiserBob is released under the **MIT License**.

By contributing to RiserBob, you agree that:

1. **Your contributions are voluntary.** You retain the copyright to your original contributions.
2. **MIT licensing.** By submitting a contribution to the official RiserBob repository, you agree that your contribution will be distributed as part of RiserBob under the project's MIT License.
3. **Contribution rights.** You confirm that you have the legal right to submit the code, tests, documentation, or other materials you contribute.
4. **No guarantee of acceptance.** Submitting a contribution does not guarantee that it will be reviewed, accepted, or merged.
5. **Third-party materials.** Do not submit code or materials that you do not have permission to contribute under the MIT License.

Contributors retain the copyright to their original work while allowing it to be used, modified, and redistributed under the MIT License as part of RiserBob.

Your own applications built with RiserBob remain yours. The MIT License does not require you to open-source your applications simply because they use RiserBob.

For the complete license terms, see the [LICENSE](LICENSE) file.

## Questions

If something is unclear, open an Issue or contact the project maintainer through the contact information in the repository.

Thank you for helping make RiserBob better! 🧽🍍
