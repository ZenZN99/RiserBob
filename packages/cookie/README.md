# 🍪 @riser-bob/cookie

**A secure, lightweight, and TypeScript-first cookie management library for Bun and modern JavaScript runtimes.**

`@riser-bob/cookie` provides a simple API for reading request cookies, setting and deleting cookies, signing cookie values with HMAC-SHA256, and applying `Set-Cookie` headers to HTTP responses.

Designed with security-conscious defaults, explicit validation, and predictable behavior, it can be used independently or alongside the RiserBob framework.

[![npm version](https://img.shields.io/npm/v/@riserbob/cookie)](https://www.npmjs.com/package/@riserbob/cookie)
[![npm downloads](https://img.shields.io/npm/dm/@riserbob/cookie)](https://www.npmjs.com/package/@riserbob/cookie)
[![TypeScript](https://img.shields.io/badge/TypeScript-supported-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## ✨ Features

- **Simple cookie management** — Read, set, check, list, and delete cookies.
- **Secure defaults** — Cookies default to `HttpOnly`, `Secure`, `Path=/`, and `SameSite=Lax`.
- **Signed cookies** — Protect cookie values against undetected tampering using HMAC-SHA256.
- **Secret rotation** — Verify cookies using multiple secrets while signing new cookies with the first secret.
- **Response integration** — Apply pending `Set-Cookie` headers directly to a `Response`.
- **Request integration** — Initialize a manager from a standard Fetch API `Request`.
- **Cookie deletion** — Generate expired cookies to request removal by the browser.
- **Input validation** — Validate cookie names, attributes, lifetimes, and serialized cookie sizes.
- **Header size protection** — Ignore oversized incoming cookie headers and expose that condition through `headerRejected`.
- **TypeScript support** — Exported types for cookie options, manager configuration, and structured errors.
- **Predictable state management** — Keep a current cookie view and track outgoing cookie changes separately.

## 📦 Installation

Install the package using your preferred package manager.

```bash
bun add @riser-bob/cookie
```

Or with npm:

```bash
npm install @riser-bob/cookie
```

Or with pnpm:

```bash
pnpm add @riser-bob/cookie
```

Or with Yarn:

```bash
yarn add @riser-bob/cookie
```

## 🚀 Quick start

```ts
import { CookieManager } from '@riser-bob/cookie'

// Create a manager for outgoing cookies.
const cookies = new CookieManager()

cookies.set('theme', 'dark', {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
})

// Inspect the generated Set-Cookie headers.
console.log(cookies.getSetCookieHeaders())
```

To apply the cookies to an HTTP response:

```ts
const response = new Response(
  JSON.stringify({ message: 'Cookie created successfully' }),
  {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  },
)

const responseWithCookies = cookies.applyTo(response)

return responseWithCookies
```

`applyTo()` adds pending cookies to the response. If no cookies are pending, it returns the original response.

## 📖 API reference

### `CookieManager`

The main class for managing incoming and outgoing cookies.

```ts
new CookieManager(cookieHeader?, options?)
```

| Parameter | Type | Description |
|---|---|---|
| `cookieHeader` | `string \| null` | Incoming `Cookie` header value |
| `options` | `CookieManagerOptions` | Secrets, defaults, and header size limit |

Both parameters are optional.

```ts
const cookies = new CookieManager()

const incomingCookies = new CookieManager(
  'theme=dark; language=en',
)
```

The first argument represents an incoming `Cookie` header, not an outgoing `Set-Cookie` header.

### `CookieManager.fromRequest()`

Creates a manager using the `Cookie` header from a Fetch API `Request`.

```ts
static fromRequest(
  request: Request,
  options?: CookieManagerOptions,
): CookieManager
```

Example:

```ts
const cookies = CookieManager.fromRequest(request)

const theme = cookies.get('theme')
```

To configure signed-cookie verification:

```ts
const cookies = CookieManager.fromRequest(request, {
  secrets: [process.env.COOKIE_SECRET!],
})
```

Ensure that `COOKIE_SECRET` is configured and validated before starting the application.

### `get()`

Returns the value of a cookie, or `undefined` if it does not exist.

```ts
const theme = cookies.get('theme')
```

### `has()`

Checks whether a cookie exists in the manager's current view.

```ts
if (cookies.has('session')) {
  console.log('A session cookie is present.')
}
```

This checks presence only. It does not validate a session or verify a cookie signature.

### `names()`

Returns the names of cookies in the current view.

```ts
const names = cookies.names()

console.log(names)
// ['theme', 'session']
```

### `getAll()`

Returns a read-only-typed object containing the current cookie names and values.

```ts
const allCookies = cookies.getAll()

console.log(allCookies)
```

**Security note:** Cookie values can contain session identifiers or other sensitive information. Avoid returning this object from public endpoints or logging it in production.

The returned object is a snapshot; subsequent manager changes do not update that object.

### `set()`

Creates or updates a cookie and queues its serialized `Set-Cookie` header.

```ts
set(
  name: string,
  value: string,
  options?: CookieOptions,
): this
```

Example:

```ts
cookies.set('theme', 'dark', {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 3600,
})
```

The method returns the manager instance, allowing chained calls:

```ts
cookies
  .set('theme', 'dark')
  .set('language', 'en')
```

Each call uses the configured defaults and validates the resulting cookie options before updating manager state.

### `setSigned()`

Creates a signed cookie using HMAC-SHA256.

```ts
setSigned(
  name: string,
  value: string,
  options?: CookieOptions,
): this
```

Configure at least one secret when constructing the manager:

```ts
const cookies = new CookieManager(undefined, {
  secrets: [process.env.COOKIE_SECRET!],
})

cookies.setSigned('session', 'session-id', {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
})
```

Signed cookies allow the server to detect unauthorized modifications to their values.

**Important:** Signing does not encrypt a cookie. Its contents remain readable by the client unless you use a separate encryption mechanism.

### `getSigned()`

Verifies a signed cookie and returns its original value when verification succeeds.

```ts
getSigned(name: string): string | undefined
```

Example:

```ts
const cookies = CookieManager.fromRequest(request, {
  secrets: [process.env.COOKIE_SECRET!],
})

const sessionId = cookies.getSigned('session')

if (sessionId === undefined) {
  // Missing, unsigned, tampered, or signed with an unknown secret.
}
```

The method returns `undefined` when the cookie is missing, unsigned, modified, or cannot be verified using the configured secrets.

It does not throw for these verification failures.

**A valid signature does not establish that a session is still active.** The application must still validate the session against its own session store or authentication system.

### `delete()`

Queues an expired cookie to request deletion by the browser and removes the cookie from the manager's current view.

```ts
delete(
  name: string,
  options?: CookieDeleteOptions,
): this
```

Example:

```ts
cookies.delete('session', {
  path: '/',
  secure: true,
  sameSite: 'lax',
})
```

Cookie deletion depends on matching the relevant attributes of the original cookie, particularly its path and domain.

For a cookie created with a custom path or domain, pass the corresponding options when deleting it.

### `getSetCookieHeaders()`

Returns a copy of the pending serialized `Set-Cookie` headers.

```ts
const headers = cookies.getSetCookieHeaders()
```

Example output:

```ts
[
  'theme=dark; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax',
]
```

The exact serialized attributes depend on the cookie options and the serialization library.

Each cookie is represented by its own header string. Do not join multiple cookies into one comma-separated `Set-Cookie` header.

### `applyTo()`

Applies pending `Set-Cookie` headers to a response.

```ts
applyTo(response: Response): Response
```

Example:

```ts
const response = Response.json({
  message: 'Logged in successfully',
})

return cookies.applyTo(response)
```

The method:

- Appends one `Set-Cookie` header per pending cookie.
- Preserves existing response headers.
- Returns the original response when no cookies are pending.
- Creates a replacement response if the original response headers cannot be modified.

Call it before returning the final response from your route handler.

### `headerRejected`

A read-only boolean indicating whether an incoming cookie header was ignored because it exceeded the configured size limit.

```ts
const cookies = CookieManager.fromRequest(request)

if (cookies.headerRejected) {
  // Apply the application's appropriate request-handling policy.
}
```

The default maximum incoming `Cookie` header size is 16 KiB.

### `CookieError`

A structured error thrown for invalid input or invalid configuration.

```ts
import { CookieError } from '@riser-bob/cookie'

try {
  cookies.set('invalid name', 'value')
} catch (error) {
  if (error instanceof CookieError) {
    console.error(error.code)
    console.error(error.message)
  }
}
```

Available error codes:

| Code | Meaning |
|---|---|
| `INVALID_NAME` | Invalid cookie name |
| `INVALID_VALUE` | Cookie value must be a string |
| `INVALID_OPTION` | Invalid cookie option or incompatible attributes |
| `COOKIE_TOO_LARGE` | Serialized cookie exceeds the size limit |
| `SERIALIZATION_FAILED` | Cookie serialization failed |
| `SECRETS_REQUIRED` | A secret is required to create a signed cookie |
| `WEAK_SECRET` | A configured signing secret is too short or invalid |

Reading cookies is designed not to throw for ordinary missing or invalid signed-cookie values.

## ⚙️ Configuration

### `CookieManagerOptions`

```ts
export interface CookieManagerOptions {
  secrets?: readonly string[]
  defaults?: CookieOptions
  maxHeaderBytes?: number
}
```

#### `secrets`

An ordered list of signing secrets.

```ts
const options = {
  secrets: [process.env.COOKIE_SECRET!],
}
```

Requirements:

- Each secret must be a string of at least 32 characters.
- The first secret signs new cookies.
- All configured secrets are tried during verification.
- Secret configuration is required for `setSigned()`, but not for ordinary cookies or reading unsigned cookies.

Use environment variables or a secret manager instead of hardcoding production secrets.

#### `defaults`

Options applied to every cookie unless overridden by an explicitly defined option.

Built-in defaults:

```ts
{
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
}
```

Configure application-wide defaults:

```ts
const cookies = new CookieManager(undefined, {
  defaults: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
  },
})
```

To override an individual default:

```ts
cookies.set('theme', 'dark', {
  secure: false,
})
```

Explicitly supplied `undefined` values are ignored rather than overriding defaults.

For local development over plain HTTP, you may configure `secure: false` where needed. Browsers generally require secure contexts for secure cookies, with special handling that varies by browser and localhost behavior.

#### `maxHeaderBytes`

Sets the maximum accepted size of an incoming `Cookie` header in bytes.

Default: `16384` bytes (16 KiB).

```ts
const cookies = CookieManager.fromRequest(request, {
  maxHeaderBytes: 8 * 1024,
})
```

If the header exceeds the configured limit, it is ignored and `headerRejected` becomes `true`.

## 🍪 Cookie options

```ts
export interface CookieOptions {
  domain?: string
  path?: string
  expires?: Date
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: boolean | 'lax' | 'strict' | 'none'
  priority?: 'low' | 'medium' | 'high'
  partitioned?: boolean
}
```

| Option | Description |
|---|---|
| `domain` | Domain that can receive the cookie |
| `path` | URL path for which the cookie is available |
| `expires` | Absolute expiration date |
| `maxAge` | Lifetime in seconds |
| `httpOnly` | Prevents access through `document.cookie` |
| `secure` | Restricts transmission to secure contexts, subject to browser rules |
| `sameSite` | Controls cross-site cookie behavior |
| `priority` | Cookie priority hint: `low`, `medium`, or `high` |
| `partitioned` | Requests partitioned cookie storage where supported |

### SameSite

The supported string values are:

- `'strict'` — Restrictive cross-site behavior.
- `'lax'` — A common default for session cookies.
- `'none'` — Allows cross-site use where browser policies permit it and requires `Secure`.

The boolean form is also accepted by the type and serializer.

### Secure and cookie prefixes

Some cookie names impose additional requirements:

- `__Secure-` cookies require `Secure`.
- `__Host-` cookies require `Secure`, `Path=/`, and no `Domain` attribute.
- `SameSite=None` requires `Secure`.
- `Partitioned` requires `Secure`.

The manager validates these requirements and rejects incompatible options.

### Lifetime limits

The manager caps `maxAge` and future `expires` values at 400 days.

A serialized cookie larger than 4096 bytes is rejected.

## 🔐 Security best practices

### 1. Use strong secrets

Generate a random secret locally:

```bash
bun -e "console.log(crypto.randomBytes(32).toString('base64url'))"
```

Store the result in your environment configuration:

```env
COOKIE_SECRET=your_generated_secret
```

Never commit real secrets to version control or share them publicly.

### 2. Use HttpOnly for session cookies

```ts
cookies.setSigned('session', sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
})
```

`HttpOnly` prevents JavaScript from reading the cookie through `document.cookie`. It does not prevent the browser from sending the cookie with eligible requests.

### 3. Validate sessions on the server

A signed cookie proves that its value matches a configured signature. It does not prove that the session has not expired, been revoked, or become unauthorized.

Use a server-side session store or another appropriate authentication mechanism.

### 4. Never expose session secrets

Avoid returning raw session cookies or the result of `getAll()` in API responses. Avoid logging cookie values, signing secrets, and authentication tokens.

### 5. Handle cross-origin requests correctly

For browser-based applications that send cookies across origins, configure CORS with explicit allowed origins and credentials where appropriate. The browser must also accept the cookie's attributes and allow it to be sent on the relevant request.

Cookie management and CORS are separate concerns.

## 🧩 Integration with RiserBob

The package can be used with RiserBob's request and response APIs.

```ts
import { CookieManager } from '@riser-bob/cookie'

bob.spongGet('/cookie/set', (spongReq, spongRes) => {
  const cookies = CookieManager.fromRequest(spongReq.request)

  cookies.set('theme', 'dark', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  })

  const response = spongRes.SpongOK({
    message: 'Cookie created',
  })

  return cookies.applyTo(response)
})
```

Read a cookie:

```ts
bob.spongGet('/cookie/get', (spongReq, spongRes) => {
  const cookies = CookieManager.fromRequest(spongReq.request)

  return spongRes.SpongOK({
    hasSession: cookies.has('session'),
  })
})
```

Delete a cookie:

```ts
bob.spongPost('/cookie/logout', (spongReq, spongRes) => {
  const cookies = CookieManager.fromRequest(spongReq.request)

  cookies.delete('session', {
    path: '/',
    secure: true,
    sameSite: 'lax',
  })

  return cookies.applyTo(
    spongRes.SpongOK({
      message: 'Logged out',
    }),
  )
})
```

For a signed session, pass the same signing secret configuration when creating the manager that writes or verifies the cookie.

**Integration note:** Each example assumes the RiserBob response helper returns a standard `Response`, as in the API shown. If your application has different response behavior, adapt the final response handling accordingly.

## 🧪 Testing

Run the package's test suite using Bun:

```bash
bun test
```

To run a specific test file:

```bash
bun test test/cookie.test.ts
```

The test suite should cover:

- Cookie creation and option validation.
- Secure defaults and cookie prefixes.
- Cookie deletion and expiration.
- Signed-cookie verification and tamper detection.
- Secret rotation.
- Header-size limits.
- Duplicate cookie writes.
- Response header application, including immutable headers.

Always run the full test suite before publishing a new release.

## 📚 Dependencies

The implementation uses:

- [`cookie`](https://www.npmjs.com/package/cookie) for cookie parsing and serialization.
- `node:crypto` for HMAC-SHA256 signatures and timing-safe comparison.

Ensure the target runtime supports the required Node.js-compatible APIs.

## 🛣️ Roadmap

Potential future improvements include:

- Additional cookie utilities and diagnostics.
- Expanded browser-compatibility tests.
- More examples for session-based authentication.
- Improved documentation and integration recipes.

This roadmap describes possible future work, not guaranteed features or release commitments.

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

Before submitting a pull request:

1. Reproduce the issue or describe the proposed improvement.
2. Add or update tests.
3. Run the full test suite.
4. Update documentation when the public API changes.

Please ensure security-related changes preserve cookie validation and signature verification guarantees.

## 📄 License

See the [`LICENSE`](LICENSE) file in this repository for the applicable license.

## 🧽 Part of the RiserBob ecosystem

`@riser-bob/cookie` is designed to provide focused cookie-management functionality that can be used independently or integrated into RiserBob applications.

**Simple API. Explicit security. Predictable behavior.**