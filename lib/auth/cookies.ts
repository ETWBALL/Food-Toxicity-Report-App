import type { NextResponse } from 'next/server';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const SECURE = process.env.NODE_ENV === 'production';

export function accessCookieMaxAgeSec(): number {
  const raw = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  return parseDurationToSeconds(raw, 15 * 60);
}

export function refreshCookieMaxAgeSec(): number {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
  return parseDurationToSeconds(raw, 7 * 24 * 60 * 60);
}

/** Parses strings like 15m, 7d, 3600 (seconds if numeric). */
function parseDurationToSeconds(value: string, fallback: number): number {
  const trimmed = value.trim();
  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed === String(num)) {
    return Math.max(1, Math.floor(num));
  }
  const m = trimmed.match(/^(\d+)([smhd])$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86400 : 1;
  return Math.max(1, n * mult);
}

export type CookiePair = { accessToken: string; refreshToken: string };

export function applyAuthCookies(res: NextResponse, tokens: CookiePair): NextResponse {
  const accessMax = accessCookieMaxAgeSec();
  const refreshMax = refreshCookieMaxAgeSec();
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMax,
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: refreshMax,
  });
  return res;
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, secure: SECURE, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}

function readCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const segments = cookieHeader.split(';');
  for (const segment of segments) {
    const idx = segment.indexOf('=');
    if (idx === -1) continue;
    const k = segment.slice(0, idx).trim();
    if (k !== name) continue;
    const v = segment.slice(idx + 1).trim();
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return undefined;
}

export function readTokensFromRequest(req: Request): { access?: string; refresh?: string } {
  const raw = req.headers.get('cookie');
  const access = readCookieFromHeader(raw, ACCESS_COOKIE);
  const refresh = readCookieFromHeader(raw, REFRESH_COOKIE);
  return {
    ...(access ? { access } : {}),
    ...(refresh ? { refresh } : {}),
  };
}
