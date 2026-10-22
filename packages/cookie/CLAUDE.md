# CLAUDE.md — @riserbob/cookie

@AGENTS.md

The shared project guidance (stack, layout, code style, architecture, security invariants, testing, docs) lives in `AGENTS.md` and is imported above. This file only adds Claude-specific working notes.

## Workflow

1. Read `cookie.ts` and the relevant part of `test/cookie.test.ts` before proposing changes.
2. Make the smallest change that solves the problem. Do not refactor unrelated code.
3. Add or update tests together with the change, then run `bun test` and report the actual output (pass/fail counts). If you cannot run it, say so instead of assuming success.
4. Update `README.md` if a public behavior, default, option, or error code changed.
5. In the final message, list the files changed and why.

## Rules of engagement

- **Do not invent APIs or files.** If something is missing (for example `package.json` scripts, an index/export file, or RiserBob internals such as `SpongRequest` / `SpongResponse`), ask for it.
- **Prove before you fix.** For bug reports, identify the cause from the actual code and logs first. Distinguish what the evidence proves from what is only likely.
- **Security first.** Never weaken the invariants listed in `AGENTS.md`. If a request conflicts with them (for example making `Secure` off by default), explain the risk and propose an explicit opt-in instead.
- Do not touch the cookie name `session` semantics or suggest swapping to JWT as a fix for cookie delivery problems unless asked.
- Prefer explaining the _why_ and the consequence of skipping a safeguard; the maintainer values that level of detail.

## Language

The maintainer chats in Arabic. Reply in Arabic in conversation, but keep code, comments, commit messages, `README.md`, `AGENTS.md`, and `CLAUDE.md` in English unless asked otherwise.

## Quick reference

```bash
bun test                      # full suite
bun test test/cookie.test.ts  # single file
```

Debugging "Set-Cookie is sent but Cookie never comes back" (browser side):

1. Compare the page origin host with the API host (`localhost` vs `127.0.0.1` are different sites).
2. DevTools → Network → the response → **Cookies** tab (blocked cookies and reasons); next request → **Cookies** tab with "Show filtered out request cookies".
3. Log `origin`, `host`, `sec-fetch-site`, and `cookie` on the receiving route to confirm.
