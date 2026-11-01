/**
 * Extracts a token from a Cookie header.
 * Returns null when the cookie is missing or malformed.
 */
export function extractCookieToken(
  cookieHeader: string | null | undefined,
  cookieName: string,
): string | null {
  if (!cookieHeader || !cookieName) return null;

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex === -1) continue;

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();

    if (name !== cookieName || !value) continue;

    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  return null;
}
