@AGENTS.md

# CLAUDE.md

Claude-specific notes. The shared project guidance is imported from `AGENTS.md` above.

## Working in this repo

- Run `bun test` after every change and report the result honestly. Do not claim success on failing tests.
- Read a file before editing it, and prefer small targeted edits over rewriting whole files.
- Before changing behavior covered by tests, read the related tests first. They document intended behavior (for example middleware ordering and validator null handling).
- When a test fails, find out whether the code or the test is wrong, and explain your reasoning briefly before changing either.
- Match existing style exactly: tabs, single quotes, no semicolons, `spongReq` and `spongRes` parameter names.
- Do not create new files (docs, scripts, helpers) unless the task needs them.
- Ask before adding dependencies, changing the license, or altering the public `Sponge*` API.

## Git

- Use short, imperative commit messages (for example `Fix Allow header missing on 405 responses`).
- Do not commit or push unless asked.
