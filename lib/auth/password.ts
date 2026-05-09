import { compare, genSaltSync, hashSync } from 'bcrypt-ts';

export function hashPassword(plain: string): string {
  const salt = genSaltSync(10);
  return hashSync(plain, salt);
}

export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return compare(plain, passwordHash);
}
