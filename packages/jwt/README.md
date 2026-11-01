# 🔑 @riser-bob/jwt

**A secure, lightweight, and TypeScript-first JWT manager for Bun and modern JavaScript runtimes.**

`@riser-bob/jwt` provides a simple API for signing and verifying access and refresh tokens, rotating refresh tokens, and extracting tokens from `Authorization` and `Cookie` headers.

Designed with security-conscious defaults and predictable behavior, it can be used independently or alongside the RiserBob framework.

[![npm version](https://img.shields.io/npm/v/@riser-bob/jwt)](https://www.npmjs.com/package/@riser-bob/jwt)
[![npm downloads](https://img.shields.io/npm/dm/@riser-bob/jwt)](https://www.npmjs.com/package/@riser-bob/jwt)
[![TypeScript](https://img.shields.io/badge/TypeScript-supported-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## ✨ Features

- **Access and refresh tokens** — Separate secrets and lifetimes for each token type.
- **Token type protection** — A refresh token can never be accepted as an access token, and vice versa.
- **Refresh token rotation** — Verify a refresh token and issue a brand new pair in one call.
- **Algorithm pinning** — Only the configured algorithm is accepted on verification.
- **Issuer and audience** — Optionally added on signing and required on verification.
- **Strict secret validation** — Secrets must be different and at least 32 characters by default.
- **Two verification styles** — `verify*` returns `null`, `assert*` throws `HttpError(401)`.
- **Header helpers** — Extract tokens from `Authorization: Bearer` and `Cookie` headers.
- **TypeScript support** — Generic payload typing and exported configuration types.

## 📦 Installation

```bash
bun add @riser-bob/jwt
```

Or with npm:

```bash
npm install @riser-bob/jwt
```

`riser-bob` is a peer dependency and must be installed in your project.

## 🚀 Quick start

```ts
import { JwtManager } from '@riser-bob/jwt';

interface AuthPayload extends Record<string, unknown> {
  id: number;
  role: 'user' | 'admin';
}

const jwt = new JwtManager<AuthPayload>({
  accessToken: { secret: process.env.ACCESS_SECRET!, expiresIn: '15m' },
  refreshToken: { secret: process.env.REFRESH_SECRET!, expiresIn: '30d' },
  issuer: 'my-app',
});

// Login: issue a token pair
const { accessToken, refreshToken } = jwt.signPair({ id: 1, role: 'user' });

// Protect a route: returns the payload or throws HttpError(401)
const user = jwt.assertAccessToken(accessToken);

// Refresh: returns a brand new pair
const next = jwt.refresh(refreshToken);
```

## 📖 API reference

### `JwtManager`

```ts
new JwtManager<TPayload>(config: JwtConfig)
```

The constructor throws `HttpError(500)` when a secret is missing, when both secrets are identical, or when a secret is shorter than `minSecretLength`.

### `signAccessToken()` / `signRefreshToken()`

Sign a single token of the given type.

```ts
const accessToken = jwt.signAccessToken({ id: 1, role: 'user' });
const refreshToken = jwt.signRefreshToken({ id: 1, role: 'user' });
```

Reserved claims (`iat`, `exp`, `nbf`, `iss`, `aud`) in the payload are ignored, so they cannot conflict with the configured options.

### `signPair()`

Signs an access token and a refresh token for the same payload.

```ts
const { accessToken, refreshToken } = jwt.signPair({ id: 1, role: 'user' });
```

### `verifyAccessToken()` / `verifyRefreshToken()`

Return the payload, or `null` if the token is invalid, expired, tampered with, or of the wrong type. They never throw.

```ts
const payload = jwt.verifyAccessToken(token);

if (payload === null) {
  // Invalid or expired token.
}
```

### `assertAccessToken()` / `assertRefreshToken()`

Like the `verify*` methods, but throw `HttpError(401)` on failure. They also accept `null` and `undefined`, which makes them convenient to combine with the header helpers.

```ts
const user = jwt.assertAccessToken(extractBearerToken(header));
```

### `refresh()`

Verifies a refresh token and issues a new access and refresh token pair (refresh token rotation). Throws `HttpError(401)` if the refresh token is invalid.

```ts
const { accessToken, refreshToken } = jwt.refresh(oldRefreshToken);
```

### `decode()`

Decodes a token **without verifying it**.

```ts
const payload = jwt.decode(token);
```

**Security note:** Never use the result of `decode()` for authentication or authorization. Use it only for non-sensitive purposes, such as reading an expiry time on the client side.

### `extractBearerToken()`

Extracts the token from an `Authorization: Bearer <token>` header value. Returns `null` when the header is missing or malformed.

```ts
import { extractBearerToken } from '@riser-bob/jwt';

const token = extractBearerToken(request.headers.get('authorization'));
```

### `extractCookieToken()`

Extracts a token from a `Cookie` header by cookie name. Returns `null` when the cookie is missing, empty, or malformed.

```ts
import { extractCookieToken } from '@riser-bob/jwt';

const token = extractCookieToken(request.headers.get('cookie'), 'refreshToken');
```

This function reads a cookie value only. It does not verify anything, so pass the result to `assertRefreshToken()` or `verifyRefreshToken()`.

## ⚙️ Configuration

### `JwtConfig`

```ts
export interface JwtConfig {
  accessToken: TokenConfig;
  refreshToken: TokenConfig;
  issuer?: string;
  audience?: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512';
  minSecretLength?: number;
}

export interface TokenConfig {
  secret: string;
  expiresIn?: string | number;
}
```

| Option                   | Default   | Description                                            |
| ------------------------ | --------- | ------------------------------------------------------ |
| `accessToken.secret`     | required  | Secret used to sign and verify access tokens           |
| `accessToken.expiresIn`  | `'15m'`   | Access token lifetime                                  |
| `refreshToken.secret`    | required  | Secret used to sign and verify refresh tokens          |
| `refreshToken.expiresIn` | `'30d'`   | Refresh token lifetime                                 |
| `issuer`                 | none      | Added as `iss` and required on verification            |
| `audience`               | none      | Added as `aud` and required on verification            |
| `algorithm`              | `'HS256'` | The only algorithm accepted on verification            |
| `minSecretLength`        | `32`      | Minimum secret length. Set to `0` to disable the check |

`expiresIn` accepts a duration string such as `'15m'` or `'30d'`, or a number of seconds.

## 🔐 Security best practices

### 1. Use strong, separate secrets

Generate a random secret for each token type:

```bash
bun -e "console.log(crypto.randomBytes(32).toString('base64url'))"
```

```env
ACCESS_SECRET=your_generated_access_secret
REFRESH_SECRET=your_generated_refresh_secret
```

Never commit real secrets to version control.

### 2. Keep access tokens short-lived

A short access token lifetime limits the damage of a leaked token. Use the refresh token to obtain new access tokens.

### 3. Store refresh tokens in HttpOnly cookies

For browser applications, keep the refresh token in an `HttpOnly`, `Secure` cookie so JavaScript cannot read it. See the example below using `@riser-bob/cookie`.

### 4. Rotation does not revoke old tokens

`refresh()` issues a new pair, but the previous refresh token stays valid until it expires. For full revocation, store token or session identifiers on the server and check them on every refresh.

### 5. Do not put sensitive data in the payload

JWTs are signed, not encrypted. Their contents are readable by anyone who holds the token.

## 🧩 Integration with RiserBob

Use the JWT manager together with `@riser-bob/cookie` to keep the refresh token in an `HttpOnly` cookie:

```ts
import {
  JwtManager,
  extractBearerToken,
  extractCookieToken,
} from '@riser-bob/jwt';
import { CookieManager } from '@riser-bob/cookie';

const jwt = new JwtManager<{ id: number }>({
  accessToken: { secret: process.env.ACCESS_SECRET! },
  refreshToken: { secret: process.env.REFRESH_SECRET! },
});

// Login: access token in the body, refresh token in a cookie
bob.spongPost('/auth/login', (spongReq, spongRes) => {
  const { accessToken, refreshToken } = jwt.signPair({ id: 1 });

  const cookies = new CookieManager();
  cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/auth',
    maxAge: 60 * 60 * 24 * 30,
  });

  return cookies.applyTo(spongRes.SpongOK({ accessToken }));
});

// Protected route
bob.spongGet('/me', (spongReq, spongRes) => {
  const token = extractBearerToken(
    spongReq.request.headers.get('authorization'),
  );
  const user = jwt.assertAccessToken(token);

  return spongRes.SpongOK({ id: user.id });
});

// Refresh
bob.spongPost('/auth/refresh', (spongReq, spongRes) => {
  const token = extractCookieToken(
    spongReq.request.headers.get('cookie'),
    'refreshToken',
  );
  // A missing or invalid token makes refresh() throw HttpError(401).
  const { accessToken, refreshToken } = jwt.refresh(token ?? '');

  const cookies = new CookieManager();
  cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/auth',
    maxAge: 60 * 60 * 24 * 30,
  });

  return cookies.applyTo(spongRes.SpongOK({ accessToken }));
});
```

**Integration note:** The examples assume that `HttpError` thrown by the manager is converted into an HTTP response by your RiserBob error handling, and that the response helpers return a standard `Response`. Adapt them if your application behaves differently.

## 🧪 Testing

```bash
bun test
```

The test suite covers:

- Constructor validation and secret rules.
- Sign and verify round trips for both token types.
- Token type separation, algorithm pinning, and tamper detection.
- Expiry, issuer, and audience checks.
- Refresh token rotation.
- Header extraction helpers.

Always run the full test suite before publishing a new release.

## 📚 Dependencies

- [`jsonwebtoken`](https://www.npmjs.com/package/jsonwebtoken) for signing and verifying tokens.
- `riser-bob` (peer dependency) for `HttpError`.

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

1. Reproduce the issue or describe the proposed improvement.
2. Add or update tests.
3. Run the full test suite.
4. Update documentation when the public API changes.

Please ensure security-related changes preserve token verification guarantees.

## 📄 License

See the [`LICENSE`](LICENSE) file in this repository.

## 🧽 Part of the RiserBob ecosystem

`@riser-bob/jwt` provides focused token management that can be used independently or integrated into RiserBob applications.

**Simple API. Explicit security. Predictable behavior.**
