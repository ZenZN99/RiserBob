import { describe, expect, it } from 'bun:test';
import { HttpError } from 'riser-bob';
import jwt from 'jsonwebtoken';
import { JwtManager, extractBearerToken } from '../src';

interface UserPayload extends Record<string, unknown> {
  id: number;
  role: string;
}

const ACCESS_SECRET = 'a'.repeat(32);
const REFRESH_SECRET = 'b'.repeat(32);

const createManager = (overrides: Partial<ConstructorParameters<typeof JwtManager>[0]> = {}) =>
  new JwtManager<UserPayload>({
    accessToken: { secret: ACCESS_SECRET },
    refreshToken: { secret: REFRESH_SECRET },
    ...overrides,
  });

const user: UserPayload = { id: 1, role: 'admin' };

describe('JwtManager constructor', () => {
  it('throws when the access secret is missing', () => {
    expect(
      () =>
        new JwtManager({
          accessToken: { secret: '' },
          refreshToken: { secret: REFRESH_SECRET },
        }),
    ).toThrow(HttpError);
  });

  it('throws when the refresh secret is missing', () => {
    expect(
      () =>
        new JwtManager({
          accessToken: { secret: ACCESS_SECRET },
          refreshToken: { secret: '' },
        }),
    ).toThrow(HttpError);
  });

  it('throws when both secrets are identical', () => {
    expect(
      () =>
        new JwtManager({
          accessToken: { secret: ACCESS_SECRET },
          refreshToken: { secret: ACCESS_SECRET },
        }),
    ).toThrow(HttpError);
  });

  it('throws when a secret is shorter than the minimum length', () => {
    expect(
      () =>
        new JwtManager({
          accessToken: { secret: 'short' },
          refreshToken: { secret: 'other-short' },
        }),
    ).toThrow(HttpError);
  });

  it('allows short secrets when minSecretLength is 0', () => {
    expect(
      () =>
        new JwtManager({
          accessToken: { secret: 'a' },
          refreshToken: { secret: 'b' },
          minSecretLength: 0,
        }),
    ).not.toThrow();
  });
});

describe('sign and verify', () => {
  it('round-trips an access token', () => {
    const manager = createManager();
    const payload = manager.verifyAccessToken(manager.signAccessToken(user));

    expect(payload?.id).toBe(1);
    expect(payload?.role).toBe('admin');
  });

  it('round-trips a refresh token', () => {
    const manager = createManager();
    const payload = manager.verifyRefreshToken(manager.signRefreshToken(user));

    expect(payload?.id).toBe(1);
  });

  it('does not leak the internal tokenType claim', () => {
    const manager = createManager();
    const payload = manager.verifyAccessToken(manager.signAccessToken(user));

    expect(payload).not.toHaveProperty('tokenType');
  });

  it('rejects a refresh token used as an access token', () => {
    const manager = createManager();

    expect(manager.verifyAccessToken(manager.signRefreshToken(user))).toBeNull();
  });

  it('rejects an access token used as a refresh token', () => {
    const manager = createManager();

    expect(manager.verifyRefreshToken(manager.signAccessToken(user))).toBeNull();
  });

  it('rejects a token with the right secret but the wrong type claim', () => {
    const manager = createManager();
    const forged = jwt.sign({ ...user, tokenType: 'refresh' }, ACCESS_SECRET, { expiresIn: '5m' });

    expect(manager.verifyAccessToken(forged)).toBeNull();
  });

  it('rejects expired tokens', () => {
    const manager = createManager({ accessToken: { secret: ACCESS_SECRET, expiresIn: -10 } });

    expect(manager.verifyAccessToken(manager.signAccessToken(user))).toBeNull();
  });

  it('rejects tampered tokens', () => {
    const manager = createManager();
    const token = manager.signAccessToken(user);

    expect(manager.verifyAccessToken(`${token}x`)).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(createManager().verifyAccessToken('not-a-jwt')).toBeNull();
  });

  it('rejects tokens signed with a different algorithm', () => {
    const manager = createManager();
    const token = jwt.sign({ ...user, tokenType: 'access' }, ACCESS_SECRET, { algorithm: 'HS512' });

    expect(manager.verifyAccessToken(token)).toBeNull();
  });
});

describe('issuer and audience', () => {
  const options = { issuer: 'riser-bob', audience: 'my-app' };

  it('accepts tokens from the same issuer and audience', () => {
    const manager = createManager(options);

    expect(manager.verifyAccessToken(manager.signAccessToken(user))).not.toBeNull();
  });

  it('rejects tokens from a different issuer', () => {
    const token = createManager({ ...options, issuer: 'other' }).signAccessToken(user);

    expect(createManager(options).verifyAccessToken(token)).toBeNull();
  });

  it('rejects tokens for a different audience', () => {
    const token = createManager({ ...options, audience: 'other-app' }).signAccessToken(user);

    expect(createManager(options).verifyAccessToken(token)).toBeNull();
  });
});

describe('signPair and refresh', () => {
  it('signs a valid pair', () => {
    const manager = createManager();
    const pair = manager.signPair(user);

    expect(manager.verifyAccessToken(pair.accessToken)?.id).toBe(1);
    expect(manager.verifyRefreshToken(pair.refreshToken)?.id).toBe(1);
  });

  it('issues a new valid pair from a refresh token', () => {
    const manager = createManager({ issuer: 'riser-bob' });
    const next = manager.refresh(manager.signRefreshToken(user));

    expect(manager.verifyAccessToken(next.accessToken)?.role).toBe('admin');
    expect(manager.verifyRefreshToken(next.refreshToken)?.role).toBe('admin');
  });

  it('throws 401 when refreshing with an invalid token', () => {
    expect(() => createManager().refresh('bad-token')).toThrow(HttpError);
  });

  it('throws when refreshing with an access token', () => {
    const manager = createManager();

    expect(() => manager.refresh(manager.signAccessToken(user))).toThrow(HttpError);
  });
});

describe('assert helpers', () => {
  it('returns the payload for a valid access token', () => {
    const manager = createManager();

    expect(manager.assertAccessToken(manager.signAccessToken(user)).id).toBe(1);
  });

  it('throws for a missing access token', () => {
    expect(() => createManager().assertAccessToken(undefined)).toThrow(HttpError);
  });

  it('throws for an invalid refresh token', () => {
    expect(() => createManager().assertRefreshToken('nope')).toThrow(HttpError);
  });
});

describe('decode', () => {
  it('decodes without verifying', () => {
    const manager = createManager();
    const token = manager.signAccessToken(user);

    expect(manager.decode(token)?.id).toBe(1);
  });

  it('returns null for garbage', () => {
    expect(createManager().decode('garbage')).toBeNull();
  });
});

describe('extractBearerToken', () => {
  it('extracts a valid bearer token', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive on the scheme', () => {
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it('returns null for missing or malformed headers', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Bearer a b')).toBeNull();
  });
});
