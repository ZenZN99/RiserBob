# AGENTS.md

## Project Overview

`@riser-bob/jwt` is a TypeScript-first JWT access and refresh token management library designed for the RiserBob framework and modern JavaScript runtimes.

The library provides token signing, verification, refresh operations, token extraction, and authentication-related utilities.

## Core Principles

- Prioritize security, correctness, and predictable behavior.
- Keep the public API simple and strongly typed.
- Follow existing project architecture and coding conventions.
- Avoid unnecessary dependencies.
- Maintain compatibility with the declared RiserBob peer dependency range.
- Do not introduce breaking changes without explicit approval.

## Technology Stack

- TypeScript
- Bun
- JSON Web Tokens (`jsonwebtoken`)
- RiserBob
- Bun Test

## Development Guidelines

### TypeScript

- Use strict TypeScript typing.
- Avoid `any` unless absolutely necessary.
- Prefer explicit return types for public methods.
- Keep public interfaces and exported types consistent.
- Do not weaken compiler settings to bypass errors.

### Security

- Never expose JWT secrets or sensitive token data in logs.
- Never trust decoded tokens without verification.
- Preserve algorithm restrictions during verification.
- Keep access and refresh token types separate.
- Preserve expiration, issuer, and audience validation.
- Ensure invalid tokens fail safely.
- Do not silently bypass authentication checks.

### JWT Behavior

Preserve the existing behavior of:

- `signAccessToken`
- `signRefreshToken`
- `signPair`
- `verifyAccessToken`
- `verifyRefreshToken`
- `assertAccessToken`
- `assertRefreshToken`
- `refresh`
- `decode`
- `extractBearerToken`
- `extractCookieToken`

Do not rename, remove, or change public methods without explicit approval.

Remember that `decode()` does not verify a token and must never be used as an authentication mechanism.

Refresh token rotation must not be described as full revocation unless server-side token or session tracking is implemented.

### RiserBob Integration

- Keep compatibility with the declared `riser-bob` peer dependency.
- Use RiserBob's `HttpError` consistently where required by the existing implementation.
- Do not assume undocumented framework APIs.
- Avoid coupling unrelated JWT functionality to unnecessary framework internals.

## Testing Requirements

Before considering a change complete:

1. Run TypeScript type checking.
2. Run the complete Bun test suite.
3. Add tests for new functionality.
4. Add regression tests for bug fixes.
5. Test invalid, expired, and tampered tokens when relevant.

Do not remove existing tests simply to make the suite pass.

## Build and Publishing

Use the existing scripts:

- `bun run typecheck`
- `bun test`
- `bun run build`
- `npm pack --dry-run`

Do not publish packages or change the npm version without explicit user approval.

Keep `package.json`, generated declarations, README documentation, and actual implementation consistent.

## Documentation

- Update README examples when public APIs change.
- Keep examples compatible with the current implementation.
- Document security limitations honestly.
- Do not claim support for unimplemented features.

## Important Rules

- Inspect existing code before making changes.
- Prefer minimal, focused modifications.
- Do not rewrite working architecture without a clear reason.
- Never invent APIs or implementation details.
- Explain breaking changes before implementing them.
- Preserve backward compatibility whenever possible.
