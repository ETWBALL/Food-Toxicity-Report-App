import type { User } from '@prisma/client';

/** Route segment `:id` — numeric DB id or `publicId` string. */
export function parseUserRef(raw: string): { id: number } | { publicId: string } {
  if (/^\d+$/.test(raw)) {
    const id = Number(raw);
    if (id > 0) return { id };
  }
  return { publicId: raw };
}

export function refMatchesCaller(ref: ReturnType<typeof parseUserRef>, caller: User): boolean {
  if ('id' in ref) {
    return caller.id === ref.id;
  }
  return caller.publicId === ref.publicId;
}
