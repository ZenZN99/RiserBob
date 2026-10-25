<h1>
  <img src="https://res.cloudinary.com/dgagbheuj/image/upload/v1792601028/riserbob/covers/keps4sy2lumzdx0ho23i.png" alt="RiserBob Logo" width="48" height="48" align="absmiddle" />
  RiserBob
</h1>

A fun and fast framework powered by Bun and TypeScript, bringing simplicity and a fresh perspective to backend development.
Stay in the Sponge Zone!

> RiserBob is distributed under the [MIT License](#license).

![RiserBob](https://res.cloudinary.com/dgagbheuj/image/upload/v1792927501/qlflwqvq6xqgxnbn0puk.png)

## Features

- **Modular Structure** — Clean, reusable modules that keep your codebase easy to maintain.
- **Ready-to-Use Middleware** — Protect routes and handle common request workflows out of the box.
- **Blazing-Fast Performance** — Built for Bun and TypeScript, with a lightweight HTTP core.
- **Built-in Validation** — Validate incoming data with a simple, developer-friendly API.
- **Integrated CLI** — Generate whole modules in seconds.
- **Fun Sponge Zone** — Playful, SpongeBob-inspired messages and errors that make debugging enjoyable.

## Installation

Requires [Bun](https://bun.sh) 1.3 or newer. There are two ways to start.

### 1. Starter template (recommended)
```bash
bun create riser-bob my-app
```

The best choice if you want a ready-made, organized template to start your project with. It creates `src/index.ts`:

```ts
import { RiserBob } from "riser-bob";
import { UsersModule } from "./modules/users/users.module";

async function bootstrap() {
  const bob = new RiserBob();
  bob.spongGet("/", async (spongReq, spongRes) => {
    return spongRes.json({
      message: "Welcome to Bikini Bottom! 🍍",
    });
  });
  new UsersModule().register(bob);
  bob.spongListen(4000, () => {
    console.log("🧽 RiserBob is running at http://localhost:4000 🍍");
  });
}

bootstrap().catch((error: unknown) => {
  console.error("[RiserBob] Failed to start application:", error);
  process.exit(1);
});
```

Then the terminal shows:

```text
  🧽 RiserBob — Project created successfully!
  📁 Location: /path/to/my-app

  Get started:
    $ cd "my-app"
    $ bun install
    $ bun run dev
  🍍 Happy coding in the Sponge Zone!
```

### 2. Start from scratch
RiserBob doesn't force anything on you. Run `bun init`, then `bun add riser-bob`. Just remember that you'll need to build the server entry file yourself (like the one above).

## Simple API, Powerful Structure

Every feature is a module of three focused files: a **controller** (the logic), a **router** (paths mapped to handlers) and a **module** that wires them together, so one call registers the whole feature: `new UsersModule().register(bob)`.

## CLI

Generate a complete module (`users.controller.ts`, `users.route.ts`, `users.module.ts`) with one command:

```bash
bun run riser-bob g module users   # `generate` also works
```
## Learn more

Docs and examples: **[riserbob.vercel.app](https://riserbob.vercel.app)**. Contributions are welcome ([CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)); report vulnerabilities privately ([SECURITY.md](SECURITY.md)).

## License
RiserBob is released under the **MIT License**. See [LICENSE](LICENSE). Copyright (c) 2026 Zen Allaham — RiserBob

<p align="center">
  <img
    src="https://res.cloudinary.com/dgagbheuj/image/upload/v1792769341/ob3ejwt32h6dtfhxg1kh.png"
    alt="RiserBob — Build APIs. Stay in the Sponge Zone."
    width="100%"
  />
</p>
