# AGENTS.md

Guidance for AI coding agents working on RiserBob, a lightweight HTTP framework for Bun.

## Commands

```bash
bun install        # Install dependencies
bun test           # Run all tests (unit + e2e)
bun test <path>    # Run a single test file
```

Always run `bun test` after making changes. The full suite must pass before you consider a task done.

## Project Structure

```text
src/
  application/   RiserBob class (route registration, spongUse, spongListen)
  errors/        HttpError and ErrorHandler
  http/          RiserBobResponse helpers
  middleware/    MiddlewarePipeline and AuthMiddleware
  routing/       Router (static and dynamic routes)
  server/        HttpServer (Bun.serve wrapper)
  types/         Shared types (SpongRequest, SpongHandler, SpongMiddleware, ...)
  validation/    Validator
test/
  unit/          Unit tests, mirroring src/
  e2e/           End-to-end tests against a real server
```

Note: the source folder is `src/middleware/`, but its unit tests live in `test/unit/middlewares/`. Import paths in tests must point to `src/middleware/...`.

## Code Style

- TypeScript with explicit types. Avoid `any`.
- Tabs for indentation, single quotes, no semicolons.
- Keep functions small and focused. Prefer clear code over clever code.
- Public API members use the `Sponge` prefix (`spongGet`, `spongUse`, `SpongRequest`, ...). Follow the existing naming.
- Handler parameters are named `spongReq` and `spongRes`, never `req` and `res`.
- Keep the project's fun tone in user-facing log and error messages (SpongeBob theme), and keep messages consistent with the existing ones.
- Do not add dependencies without asking first.

## Architecture Rules

- Handlers and middleware must return a `Response`.
- Fail with `throw new HttpError(status, message, headers?)`. `HttpServer` catches errors and converts them with `ErrorHandler.handle`.
- `ErrorHandler` exposes the message only for `HttpError`. Any other error becomes a generic `500 Internal Server Error`. Never leak internal error details to clients.
- A `405` response must include the `Allow` header (pass it through `HttpError` headers).
- Global middleware is attached **when a route is registered**. Middleware added with `spongUse` later does not affect earlier routes. Do not change this behavior without updating the tests and the README.
- Routes must start with `/`. Registering the same method and path twice throws. Static routes take priority over dynamic ones.
- Validator: `required` and `nullable` cannot be combined. A `null` value is rejected by type rules unless the field is `nullable`.

## Testing Rules

- Every bug fix needs a test that fails without the fix. Every feature needs unit tests, plus e2e tests if it affects server behavior.
- Mirror the `src/` layout under `test/unit/`.
- Tests that intentionally trigger errors must silence expected `console.error` and `console.warn` output with `spyOn(console, '...').mockImplementation(() => {})` and restore it in a `finally` block.
- `mock.module` paths are resolved relative to the **test file**, and the mock must be registered before the module under test is imported (use `await import(...)` afterwards). Bun's `mock.module` is process-wide, so it can leak into other test files.
- Do not weaken or delete a test to make it pass. If a test and the code disagree, decide which one is correct and say why.

## Documentation

When you change public behavior, update `README.md` and any affected tests in the same change.

## License

RiserBob is proprietary (see `LICENSE`). Do not copy the framework's code into other projects, do not suggest redistributing or publishing modified copies, and do not change the license or copyright notices.

## Contributions

Read `CONTRIBUTING.md` before preparing a change. Keep each change focused on a single concern, and follow the commit message style described there (short, imperative mood).
