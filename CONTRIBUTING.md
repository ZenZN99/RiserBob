# Contributing to RiserBob

Thank you for your interest in improving RiserBob! This guide explains how to report issues, propose changes, and submit code.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating, and **read the [License and Contributions](#license-and-contributions) section carefully**. RiserBob is distributed under a proprietary license, which affects how contributions work.

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

RiserBob is released under the **RiserBob Proprietary License**. Under that license, modifying, redistributing, or creating derivative versions of RiserBob is prohibited without written permission from the copyright holder. To keep contributing possible within those terms:

1. **Limited permission for contributors.** The copyright holder grants you permission to make a private copy or fork of the repository **solely for the purpose of preparing and submitting contributions** to the official project. This permission does not allow you to publish, distribute, or use the modified copy for any other purpose.
2. **Your contribution grant.** By submitting a contribution (code, tests, documentation, or other material), you:
    - confirm that you wrote it, or have the right to submit it;
    - grant the copyright holder a perpetual, worldwide, irrevocable, royalty-free license to use, modify, reproduce, distribute, sublicense, and relicense your contribution as part of RiserBob, under the RiserBob Proprietary License or any other license the copyright holder chooses;
    - understand that you receive no ownership of RiserBob itself as a result of contributing.
3. **No obligation to accept.** Submitting a contribution does not guarantee it will be merged.
4. **Other permissions.** Anything beyond the above (for example, publishing your own fork) requires prior written permission from the copyright holder, as described in the license.

Your own applications built with RiserBob remain yours, as stated in the license.

## Questions

If something is unclear, open an Issue or contact the project maintainer through the contact information in the repository.

Thank you for helping make RiserBob better! 🧽🍍
