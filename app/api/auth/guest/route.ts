import { randomUUID } from 'crypto';
import { createUser, getUser } from 'app/db';
import { ok } from '../../_lib/http';

export async function POST() {
  const guestEmail = `guest_${Date.now()}_${randomUUID().slice(0, 8)}@guest.local`;
  const guestPassword = randomUUID();
  await createUser(guestEmail, guestPassword);
  const created = await getUser(guestEmail);
  return ok({
    success: true,
    user: { id: created[0]?.id, email: guestEmail, guest: true },
  }, 201);
}
