# CLAUDE.md

## Mandatory Instructions

**Before performing any task, you MUST read and follow `AGENTS.md` located in the project root.**

- Treat `AGENTS.md` as the primary source of project-wide development instructions.
- Follow all rules, conventions, architecture guidelines, and security requirements defined in `AGENTS.md`.
- Do not start coding, modifying files, or making architectural decisions before reading `AGENTS.md`.
- If instructions in this file conflict with `AGENTS.md`, follow `AGENTS.md` unless the user explicitly instructs otherwise.
- If `AGENTS.md` is missing or unreadable, inform the user before proceeding.

## Project Identity

You are working on `@riser-bob/jwt`, a TypeScript-first JWT management library built for the RiserBob ecosystem.

Your role is to help maintain and improve the library while preserving its security, type safety, simplicity, and backward compatibility.

## Project Goals

- Provide secure access and refresh token management.
- Offer a clean and predictable TypeScript API.
- Integrate naturally with RiserBob.
- Keep the package lightweight and maintainable.
- Support a reliable open-source developer experience.

## Technical Environment

- Runtime: Bun
- Language: TypeScript
- JWT implementation: jsonwebtoken
- Framework integration: RiserBob
- Testing: Bun Test

## Coding Instructions

1. Read `AGENTS.md` before starting any task.
2. Read the existing implementation before modifying anything.
3. Follow the established architecture and naming conventions.
4. Prefer small, focused changes.
5. Maintain strict TypeScript compatibility.
6. Avoid unnecessary abstractions and dependencies.
7. Keep exported APIs backward-compatible.
8. Do not introduce code unrelated to the requested task.

## Security Rules

Security is a priority.

- Never expose secrets.
- Never authenticate users using decoded but unverified JWT payloads.
- Preserve access-token and refresh-token separation.
- Validate token signatures and expiration.
- Preserve algorithm restrictions.
- Respect issuer and audience validation when configured.
- Handle malformed and invalid tokens safely.
- Do not claim refresh-token revocation when no server-side revocation mechanism exists.
- Never weaken security checks to make tests pass.

## Existing Public API

The existing API includes:

- `JwtManager<TPayload>`
- `signAccessToken()`
- `signRefreshToken()`
- `signPair()`
- `verifyAccessToken()`
- `verifyRefreshToken()`
- `assertAccessToken()`
- `assertRefreshToken()`
- `refresh()`
- `decode()`
- `extractBearerToken()`
- `extractCookieToken()`

Treat these APIs as established public contracts.

Do not change their signatures or behavior without explaining the impact and receiving approval for breaking changes.

## Error Handling

- Follow the existing error-handling strategy.
- Use `HttpError` from RiserBob where required.
- Keep authentication errors consistent.
- Avoid leaking internal details or sensitive information through error messages.
- Do not silently swallow unexpected errors.

## Testing

Run the relevant tests after every meaningful modification.

Before completing a task, run:

```bash
bun run typecheck
bun test
```

Before preparing a release, also run:

```bash
bun run build
npm pack --dry-run
```

Additional requirements:

- New functionality must include appropriate tests.
- Bug fixes must include regression tests when applicable.
- Do not remove existing tests simply to make the suite pass.
- Do not modify test expectations merely to hide implementation bugs.
- Report any checks that could not be executed.

## Documentation

Keep README documentation synchronized with the implementation.

- Examples must use real exported APIs and valid configuration options.
- Clearly distinguish between token decoding, token verification, token refresh, and server-side token revocation.
- Document security limitations honestly.
- Never document a security feature that has not been implemented.
- Do not introduce undocumented public APIs.

## Package Management

- Respect the `peerDependencies` compatibility range.
- Do not use an unbounded framework dependency in development when it conflicts with the supported compatibility range.
- Keep development dependencies consistent with the supported RiserBob versions.
- Do not change package versions automatically.
- Do not publish to npm without explicit approval.
- Do not add unnecessary runtime dependencies.
- Keep package exports and generated TypeScript declarations consistent with the implementation.

## Versioning and Compatibility

- Follow Semantic Versioning.
- Avoid breaking changes in minor and patch releases.
- Maintain compatibility with supported RiserBob versions.
- Do not assume a new RiserBob release requires a new JWT package release.
- Verify compatibility before expanding the declared peer dependency range.
- Explain any compatibility changes before applying them.

## Communication

When implementing a task:

1. Explain the proposed change briefly.
2. Identify affected files.
3. Implement only what is necessary.
4. Run relevant checks.
5. Report modified files and test results.
6. Clearly mention any remaining limitations.

Always prioritize correctness and maintainability over unnecessary complexity.

## Final Reminder

**Read `AGENTS.md` first. Follow its instructions throughout the entire task. Never skip this requirement.**
