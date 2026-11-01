import type { SignOptions } from 'jsonwebtoken';

export type JwtPayload = Record<string, unknown>;

export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512';

export interface TokenConfig {
  /** Secret used to sign and verify this token type. */
  secret: string;
  /** Lifetime, e.g. '15m', '30d' or seconds as a number. */
  expiresIn?: SignOptions['expiresIn'];
}

export interface JwtConfig {
  accessToken: TokenConfig;
  refreshToken: TokenConfig;
  /** Added as `iss` and required on verification. */
  issuer?: string;
  /** Added as `aud` and required on verification. */
  audience?: string;
  /** Signing algorithm. Defaults to HS256. Only this algorithm is accepted on verify. */
  algorithm?: JwtAlgorithm;
  /** Minimum secret length. Defaults to 32. Set to 0 to disable the check. */
  minSecretLength?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type TokenType = 'access' | 'refresh';
