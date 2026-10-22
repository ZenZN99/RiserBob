# 🧽 RiserBob

A lightweight, fun, and fully tested HTTP framework for [Bun](https://bun.sh), with a built-in router, middleware pipeline, request validation, and consistent error handling.

> RiserBob is distributed under the [MIT License](#license).
![RiserBob](https://res.cloudinary.com/dgagbheuj/image/upload/v1792690158/yktnlpmjns4rwycciixn.png)
## Features

- **Fast routing** with static and dynamic (`/users/:id`) routes, where static routes win over dynamic ones.
- **Middleware pipeline** with global and per-route middleware, executed in registration order.
- **Built-in auth middleware** for Bearer-token authentication with your own token verifier.
- **Validator** with a simple rule syntax (`required`, `string`, `email`, `min:18`, ...).
- **Response helpers** for JSON, status codes, headers, and redirects.
- **Consistent errors** through `HttpError` and a central error handler (`404`, `405` with the `Allow` header, `500`).
- **Fully tested** with Bun's test runner (unit and end-to-end tests).

## Requirements

- [Bun](https://bun.sh) 1.3 or newer

## Installation

```bash
bun add riser-bob
```

> The examples below import from `riser-bob`. Adjust the import path if you install or reference the framework differently.

## Quick Start

```ts
import { RiserBob } from 'riser-bob'

const bob = new RiserBob()

bob.spongGet('/', async (spongReq, spongRes) => {
	return spongRes.json({ message: 'Welcome to Bikini Bottom! 🍍' })
})

bob.spongListen(4000, () => {
	console.log('RiserBob is running on http://localhost:4000')
})
```

Run it:

```bash
bun run index.ts
```

## Routing

Register routes with the `Sponge` methods. Every method returns the app, so calls can be chained.

```ts
bob.spongGet('/users', listUsers)
	.spongPost('/users', createUser)
	.spongPut('/users/:id', replaceUser)
	.spongPatch('/users/:id', updateUser)
	.spongDelete('/users/:id', deleteUser)
```

Paths must start with `/`, and registering the same method and path twice throws an error.

### Route parameters and query strings

```ts
bob.spongGet('/users/:id', async (spongReq, spongRes) => {
	const { id } = spongReq.params // decoded automatically
	const page = spongReq.query.get('page') // URLSearchParams

	return spongRes.json({ id, page })
})
```

### Reading the request body

```ts
bob.spongPost('/users', async (spongReq, spongRes) => {
	const body = await spongReq.json<{ name: string }>()

	return spongRes.json({ created: body.name })
})
```

`spongReq` also exposes `method`, `path`, `url`, `headers`, `text()`, and the original `request`.

## Middleware

A middleware receives the request and a `next` function. Return `next()` to continue, or return a `Response` to stop the chain.

```ts
import type { SpongMiddleware, SpongRequest } from 'riser-bob'

const logger: SpongMiddleware<SpongRequest> = async (spongReq, next) => {
	console.log(`${spongReq.method} ${spongReq.path}`)
	return next()
}

bob.spongUse(logger) // global middleware

bob.spongGet('/admin', handler, adminOnly) // route-specific middleware
```

> Global middleware is attached when a route is registered, so call `spongUse` **before** registering the routes it should apply to.

### Authentication

```ts
import { AuthMiddleware } from 'riser-bob'

const auth = new AuthMiddleware(async (token) => {
	// Return the user for a valid token, or null for an invalid one.
	return verifyMyToken(token)
})

bob.spongGet(
	'/me',
	async (spongReq, spongRes) => {
		return spongRes.json({ user: spongReq.user })
	},
	auth.middleware
)
```

The middleware reads the `Authorization: Bearer <token>` header. On success it sets `spongReq.user` and `spongReq.auth`. Otherwise it responds with `401` (`Unauthorized`, `Token is required`, or `Invalid or expired token`).

## Validation

```ts
import { Validator } from 'riser-bob'

const result = Validator.validate(
	{ name: 'Zen', age: 17, email: 'zen@example.com' },
	{
		name: ['required', 'string'],
		age: ['required', 'number', 'min:13'],
		email: ['required', 'email']
	}
)

if (!result.valid) {
	console.log(result.errors) // { age: ['age must be at least 13'], ... }
}
```

| Rule                            | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| `required`                      | Value must be present and not empty.                   |
| `nullable`                      | `null` is allowed. Cannot be combined with `required`. |
| `string` / `number` / `boolean` | Type checks. Numbers must be finite.                   |
| `email`                         | Must be a valid email address.                         |
| `confirmed`                     | Must match the `<field>Confirmation` value.            |
| `min:n` / `max:n`               | Numeric limit for numbers, length limit for strings.   |
| `minLength:n` / `maxLength:n`   | String length limits (integers only).                  |

Fields without `required` are optional: missing values and empty strings are skipped.

## Responses and Errors

Handlers must return a `Response`. The `spongRes` helper builds one for you, and you can always return a standard `Response` instead.

```ts
bob.spongGet('/ok', async (spongReq, spongRes) => spongRes.json({ ok: true }))
bob.spongGet('/raw', async () => new Response('plain text'))
```

To fail with a specific status, throw an `HttpError`:

```ts
import { HttpError } from 'riser-bob'

bob.spongGet('/secret', async () => {
	throw new HttpError(403, 'Forbidden')
})
```

RiserBob handles the common cases for you:

| Situation                      | Response                                                |
| ------------------------------ | ------------------------------------------------------- |
| No matching route              | `404 Not Found`                                         |
| Path exists, method does not   | `405 Method Not Allowed` with an `Allow` header         |
| Handler throws an `HttpError`  | The error's status and message                          |
| Handler throws any other error | `500 Internal Server Error` (details are never exposed) |
| Handler returns no `Response`  | `500`                                                   |

## Development

```bash
# Install dependencies
bun install

# Run all tests
bun test
```

```text
src/
  application/   RiserBob application class
  errors/        HttpError and ErrorHandler
  http/          Response helpers
  middleware/    Middleware pipeline and built-in middleware
  routing/       Router
  server/        HTTP server
  types/         Shared types
  validation/    Validator
test/
  unit/          Unit tests
  e2e/           End-to-end tests
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first. Please also follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md) for details.

## License

RiserBob is released under the **MIT License**. In short:

- You may use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software.
- You must include the copyright notice and the license text in all copies or substantial portions of the software.
- The software is provided "as is", without warranty of any kind.

See the [LICENSE](LICENSE) file for the full terms.

Copyright (c) 2026 RiserBob
