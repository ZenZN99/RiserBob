# AGENTS.md — @riserbob/cookie

Guidance for AI coding agents (and humans) working on this package.

## Overview

`@riserbob/cookie` is a small, security-focused cookie library for Bun and modern JavaScript runtimes, written in TypeScript. It reads request cookies, sets/deletes cookies, signs values with HMAC-SHA256, and applies `Set-Cookie` headers to a standard `Response`. It is used by the RiserBob HTTP framework but must stay framework-independent.

Public API (single class plus types): `CookieManager`, `CookieError`, and the types `CookieOptions`, `CookieDeleteOptions`, `CookieManagerOptions`, `CookieErrorCode`, `SameSite`, `CookiePriority`.

## Stack and commands

- Runtime / test runner: **Bun** (`bun:test`).
- Language: TypeScript.
- Runtime dependencies: `cookie` (parse / serialize) and `node:crypto` (HMAC, `timingSafeEqual`). Do not add dependencies without a strong reason.

```bash
bun test                      # run the full suite (from the package folder)
bun test test/cookie.test.ts  # run one file
```

Only `bun test` is known to exist. Do not assume build, lint, or format scripts: check `package.json` first and do not invent commands.

## Layout

```
cookie.ts            # the whole implementation (CookieManager, CookieError, types)
test/cookie.test.ts  # test suite (imports from '../cookie')
README.md            # public documentation
AGENTS.md / CLAUDE.md
```

## Code style (match the existing files)

- Tabs for indentation, single quotes, no semicolons, no trailing commas.
- Explicit return types on methods and helpers.
- Validation errors are `CookieError` with a `code`, never plain `Error`.
- Comments explain _why_, not _what_. Keep the existing explanatory comments accurate when you change behavior.
- Keep the file free of framework imports (no RiserBob types).

## How the class works (read before editing)

- **One manager per request.** A `CookieManager` holds per-request state. It must never be shared across requests.
- **Two maps.** `cookies` is the current view (request cookies plus changes made in this request). `pending` holds the `Set-Cookie` lines to send, keyed by `name + domain + path + partitioned` (joined with `\0`).
- **`set()` order matters.** `resolveOptions` → `serialize` → `record` → update `cookies`. Everything that can throw runs before any state changes, so a failed `set()` leaves the manager untouched. Preserve this ordering.
- **Last write wins and is sent last.** `record()` deletes then re-inserts the key so ordering in `pending` reflects the latest write.
- **`delete()`** emits `Expires=1970` and `Max-Age=0`, and must be called with the same `domain/path/secure/sameSite/partitioned` as the original cookie, otherwise the browser keeps it.
- **`applyTo()`** appends one `Set-Cookie` per cookie (never joined). If the response headers are immutable it returns a copy of the response.
- **`definedOnly()`** strips `undefined` so an explicitly `undefined` option never overrides a default. Use it whenever merging option objects.
- **Reading never throws.** `load()` and `getSigned()` swallow bad input and return empty / `undefined`. Only programmer mistakes (names, options, sizes, secrets) throw.

## Security invariants (do not weaken)

1. **Secure by default.** Built-in defaults are `Path=/; HttpOnly; Secure; SameSite=Lax`. In `SECURE_DEFAULTS`, `secure` must be `true`. The README, the doc comments, and the tests all assume this. If you see `secure: false` there, it is a bug, not a feature. Local HTTP development opts out explicitly with `defaults: { secure: false }`.
2. **Signature binds the name.** `sign()` signs `` `${name}=${value}` `` so a signed cookie cannot be replayed under another name.
3. **Constant-time verification.** `getSigned()` checks lengths first (since `timingSafeEqual` throws on different lengths), uses `timingSafeEqual`, and checks every secret without early exit.
4. **Last `.` separates the signature.** Signatures are `base64url` (no dots), so `lastIndexOf('.')` is correct even when the value contains dots.
5. **Secrets must be at least 32 characters.** `WEAK_SECRET` is thrown at construction time.
6. **Fail fast on bad defaults.** The constructor calls `resolveOptions('probe', {})` so contradictory defaults throw at startup.
7. **Validation rules stay strict:** cookie name regex, path/domain regex, `SameSite=None` / `Partitioned` / `__Secure-` / `__Host-` require `Secure`, `__Host-` forbids `Domain` and requires `Path=/`.
8. **Limits:** 4096-byte cookie, 400-day lifetime cap, 16 KiB incoming `Cookie` header cap (`headerRejected`).
9. Never log cookie values or secrets, and never return `getAll()` from public endpoints.
10. Signing is not encryption and does not prove a session is still valid. Do not document or imply otherwise.

## Testing rules

- Every behavior change needs a test in `test/cookie.test.ts`; every bug fix needs a regression test.
- Run the **full** suite (`bun test`) before finishing and report the real result. Do not claim tests pass without running them.
- Follow the existing helpers (`only`, `pairOf`, `expectCookieError`) and the `describe` grouping (parsing, `set()`, `delete()`, signed cookies, `applyTo()`).
- Tests that depend on the `cookie` package's encoding should tolerate both `cookie@1` and `cookie@2` behavior (see the tampered-value test).
- Do not change a test just to make it pass; first decide whether the code or the test is wrong.

## Documentation

- When the public API, a default, or an error code changes, update `README.md` in the same change.
- Keep README examples in sync with real signatures. RiserBob examples assume `spongReq.request` is a standard `Request` and `spongRes.SpongOK(...)` returns a standard `Response`.

## Boundaries

- Do not add framework-specific code, global state, or module-level mutable state.
- Do not change error codes or option names without a major-version decision.
- Do not weaken validation to "make something work". Fix the caller instead.
- If a file or API you need is not in the repository, ask for it rather than inventing it.

## Common pitfalls when using the library (useful context for answers)

- Browser not sending a cookie is usually a **Site / SameSite** problem, not a library bug. `localhost` and `127.0.0.1` are different sites; keep the page and API on the same host name during development.
- `HttpOnly` hides a cookie from `document.cookie` only. It does not stop the browser from sending it.
- CORS does not decide whether the browser attaches cookies; the cookie jar and SameSite rules do.
