/**
 * Returns a same-origin path safe for NextResponse.redirect, or null if untrusted.
 * Rejects protocol-relative paths (`//evil.com`) and backslashes.
 */
export function safeAppRedirectPath(raw: string, maxLen = 256): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return null;
  }
  if (raw.includes('\\') || raw.includes('\0')) {
    return null;
  }
  if (raw.length > maxLen) {
    return null;
  }
  return raw;
}
