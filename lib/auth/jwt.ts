import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const ACCESS_ALG = 'HS256';

function requireEnv(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): Uint8Array {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return new TextEncoder().encode(value);
}

export type AccessTokenPayload = JWTPayload & {
  email?: string;
  publicId?: string;
  typ?: string;
  /** Server token family / logout generation */
  tv?: number;
};

export type RefreshTokenPayload = JWTPayload & {
  typ?: string;
  tv?: number;
};

export async function signAccessToken(user: {
  id: number;
  email: string;
  publicId: string;
  tokenVersion: number;
}): Promise<string> {
  const secret = requireEnv('JWT_ACCESS_SECRET');
  return new SignJWT({
    email: user.email,
    publicId: user.publicId,
    typ: 'access',
    tv: user.tokenVersion,
  })
    .setProtectedHeader({ alg: ACCESS_ALG })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRES_IN ?? '15m')
    .sign(secret);
}

export async function signRefreshToken(user: { id: number; tokenVersion: number }): Promise<string> {
  const secret = requireEnv('JWT_REFRESH_SECRET');
  return new SignJWT({ typ: 'refresh', tv: user.tokenVersion })
    .setProtectedHeader({ alg: ACCESS_ALG })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d')
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const secret = requireEnv('JWT_ACCESS_SECRET');
  const { payload } = await jwtVerify(token, secret);
  if (payload.typ !== 'access') {
    throw new Error('Invalid access token');
  }
  return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const secret = requireEnv('JWT_REFRESH_SECRET');
  const { payload } = await jwtVerify(token, secret);
  if (payload.typ !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return payload as RefreshTokenPayload;
}
