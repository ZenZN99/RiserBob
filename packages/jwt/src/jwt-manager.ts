import { HttpError } from 'riser-bob';
import jwt from 'jsonwebtoken';
import type { JwtConfig, JwtPayload, TokenPair, TokenType } from './types';

const TOKEN_TYPE_CLAIM = 'tokenType';
const RESERVED_CLAIMS = new Set([
  'iat',
  'exp',
  'nbf',
  'iss',
  'aud',
  TOKEN_TYPE_CLAIM,
]);
// iat : the time at which the JWT was issued. Can be used to determine age of the JWT.
// exp : the time at which the JWT expires.
// nbf : the time at which the JWT becomes valid.
// iss : the issuer of the JWT.
// aud : the audience of the JWT.

const DEFAULT_ACCESS_TTL = '15m'; // 15 minutes
const DEFAULT_REFRESH_TTL = '30d'; // 30 days
const DEFAULT_MIN_SECRET_LENGTH = 32; // 32 characters

function stripReserved(payload: JwtPayload): JwtPayload {
  const clean: JwtPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!RESERVED_CLAIMS.has(key)) clean[key] = value;
  }
  return clean;
}

export class JwtManager<TPayload extends JwtPayload = JwtPayload> {
  private readonly algorithm: NonNullable<JwtConfig['algorithm']>; // Algorithm used for signing and verifying tokens. Defaults to HS256.

  constructor(private readonly config: JwtConfig) {
    const accessSecret = config.accessToken?.secret;
    const refreshSecret = config.refreshToken?.secret;

    if (!accessSecret) {
      throw new HttpError(500, 'Access token secret is required');
    }
    if (!refreshSecret) {
      throw new HttpError(500, 'Refresh token secret is required');
    }
    if (accessSecret === refreshSecret) {
      throw new HttpError(
        500,
        'Access and refresh token secrets must be different',
      );
    }

    const minLength = config.minSecretLength ?? DEFAULT_MIN_SECRET_LENGTH;
    if (accessSecret.length < minLength || refreshSecret.length < minLength) {
      throw new HttpError(
        500,
        `Token secrets must be at least ${minLength} characters`,
      );
    }

    this.algorithm = config.algorithm ?? 'HS256';
  }

  signAccessToken(payload: TPayload): string {
    return this.sign(payload, 'access');
  }

  signRefreshToken(payload: TPayload): string {
    return this.sign(payload, 'refresh');
  }

  /** Signs an access + refresh token pair for the same payload. */
  signPair(payload: TPayload): TokenPair {
    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: this.signRefreshToken(payload),
    };
  }

  /** Returns the payload, or null if the token is invalid or expired. */
  verifyAccessToken(token: string): TPayload | null {
    return this.verify(token, 'access');
  }

  /** Returns the payload, or null if the token is invalid or expired. */
  verifyRefreshToken(token: string): TPayload | null {
    return this.verify(token, 'refresh');
  }

  /** Like verifyAccessToken but throws HttpError(401) on failure. */
  assertAccessToken(token: string | null | undefined): TPayload {
    const payload = token ? this.verifyAccessToken(token) : null;
    if (!payload) throw new HttpError(401, 'Invalid or expired access token');
    return payload;
  }

  /** Like verifyRefreshToken but throws HttpError(401) on failure. */
  assertRefreshToken(token: string | null | undefined): TPayload {
    const payload = token ? this.verifyRefreshToken(token) : null;
    if (!payload) throw new HttpError(401, 'Invalid or expired refresh token');
    return payload;
  }

  /**
   * Verifies a refresh token and issues a brand new pair (refresh token rotation).
   * Throws HttpError(401) if the refresh token is invalid.
   */
  refresh(refreshToken: string): TokenPair {
    const payload = this.assertRefreshToken(refreshToken);
    return this.signPair(stripReserved(payload) as TPayload);
  }

  /** Decodes a token WITHOUT verifying it. Never trust the result for authorization. */
  decode(token: string): TPayload | null {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded === 'string') return null;
    return decoded as TPayload;
  }

  private sign(payload: TPayload, type: TokenType): string {
    const tokenConfig =
      type === 'access' ? this.config.accessToken : this.config.refreshToken;
    const fallbackTtl =
      type === 'access' ? DEFAULT_ACCESS_TTL : DEFAULT_REFRESH_TTL;

    return jwt.sign(
      { ...stripReserved(payload), [TOKEN_TYPE_CLAIM]: type },
      tokenConfig.secret,
      {
        algorithm: this.algorithm,
        expiresIn: tokenConfig.expiresIn ?? fallbackTtl,
        ...(this.config.issuer ? { issuer: this.config.issuer } : {}),
        ...(this.config.audience ? { audience: this.config.audience } : {}),
      },
    );
  }

  private verify(token: string, type: TokenType): TPayload | null {
    const tokenConfig =
      type === 'access' ? this.config.accessToken : this.config.refreshToken;

    try {
      const payload = jwt.verify(token, tokenConfig.secret, {
        algorithms: [this.algorithm],
        ...(this.config.issuer ? { issuer: this.config.issuer } : {}),
        ...(this.config.audience ? { audience: this.config.audience } : {}),
      });

      if (typeof payload === 'string') return null;
      if (payload[TOKEN_TYPE_CLAIM] !== type) return null;

      const { [TOKEN_TYPE_CLAIM]: _type, ...rest } = payload;
      return rest as TPayload;
    } catch {
      return null;
    }
  }
}
