/**
 * Extracts the token from an `Authorization: Bearer <token>` header value.
 * Returns null when the header is missing or malformed.
 */
export function extractBearerToken(
  header: string | null | undefined,
): string | null {
  if (!header) return null;

  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (rest.length > 0 || !token || scheme?.toLowerCase() !== 'bearer')
    return null;

  return token;
}
