export type SameSite = boolean | 'lax' | 'strict' | 'none';
export type CookiePriority = 'low' | 'medium' | 'high';
export interface CookieOptions {
    domain?: string;
    path?: string;
    expires?: Date;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: SameSite;
    priority?: CookiePriority;
    partitioned?: boolean;
}
/**
 * Attributes that must match the original cookie for the browser to
 * actually remove it.
 */
export type CookieDeleteOptions = Pick<CookieOptions, 'domain' | 'path' | 'secure' | 'sameSite' | 'partitioned'>;
export interface CookieManagerOptions {
    /**
     * Secrets used by setSigned/getSigned. The first secret signs new
     * cookies, every secret is accepted when verifying (key rotation).
     * Each secret must be at least 32 characters long.
     */
    secrets?: readonly string[];
    /**
     * Defaults applied to every cookie. The built-in defaults are
     * `Path=/; HttpOnly; Secure; SameSite=Lax`. Use `{ secure: false }`
     * for plain-HTTP local development (Safari rejects Secure cookies on
     * http://localhost).
     */
    defaults?: CookieOptions;
    /**
     * Largest `Cookie` request header (in bytes) that will be parsed.
     * Larger headers are ignored instead of being processed.
     * Default: 16 KB.
     */
    maxHeaderBytes?: number;
}
export type CookieErrorCode = 'INVALID_NAME' | 'INVALID_VALUE' | 'INVALID_OPTION' | 'COOKIE_TOO_LARGE' | 'SERIALIZATION_FAILED' | 'SECRETS_REQUIRED' | 'WEAK_SECRET';
/**
 * Thrown for programmer mistakes (bad name, bad option, oversized cookie,
 * missing secret). Reading cookies never throws.
 */
export declare class CookieError extends Error {
    readonly code: CookieErrorCode;
    constructor(code: CookieErrorCode, message: string, options?: ErrorOptions);
}
export declare class CookieManager {
    /** Current view: request cookies plus the changes made during this request. */
    private readonly cookies;
    /** Set-Cookie lines to send, one per (name, domain, path, partitioned). */
    private readonly pending;
    private readonly secrets;
    private readonly defaults;
    /** True when the incoming Cookie header was ignored for being too large. */
    readonly headerRejected: boolean;
    constructor(cookieHeader?: string | null, options?: CookieManagerOptions);
    static fromRequest(request: Request, options?: CookieManagerOptions): CookieManager;
    get(name: string): string | undefined;
    has(name: string): boolean;
    names(): string[];
    getAll(): Readonly<Record<string, string>>;
    set(name: string, value: string, options?: CookieOptions): this;
    /**
     * Sets a tamper-proof cookie (HMAC-SHA256). The value stays readable by
     * the client, it just cannot be changed without being detected.
     */
    setSigned(name: string, value: string, options?: CookieOptions): this;
    /**
     * Returns the original value, or undefined when the cookie is missing,
     * unsigned, tampered with, or signed with an unknown secret.
     */
    getSigned(name: string): string | undefined;
    /**
     * Removes a cookie. Pass the same domain/path/secure/sameSite/partitioned
     * the cookie was created with, otherwise the browser keeps it.
     */
    delete(name: string, options?: CookieDeleteOptions): this;
    getSetCookieHeaders(): string[];
    /**
     * Adds the pending Set-Cookie headers to a response. Each cookie gets its
     * own header (they must never be joined). If the response headers are
     * immutable, a copy of the response is returned instead.
     */
    applyTo(response: Response): Response;
    private load;
    private resolveOptions;
    private serialize;
    private record;
    private isExpired;
}
