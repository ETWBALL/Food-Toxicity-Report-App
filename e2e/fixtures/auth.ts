import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

type GuestUser = { id: number; publicId: string; email: string; name: string };

async function createPeanutAllergicGuest(request: APIRequestContext): Promise<GuestUser> {
  const guestRes = await request.post('/api/auth/guest');
  expect(guestRes.status(), 'guest signup').toBe(201);
  const guestJson = await guestRes.json();
  const user: GuestUser = guestJson.user;

  const allergyRes = await request.post(`/api/users/${user.id}/allergies`, {
    data: { allergen: 'peanuts', severity: 'severe' },
  });
  expect(allergyRes.ok(), 'add peanut allergy').toBeTruthy();

  return user;
}

export const test = base.extend<{ guestUser: GuestUser }>({
  guestUser: async ({ page, context }, use) => {
    const user = await createPeanutAllergicGuest(context.request);
    await use(user);
  },
});

export { expect };
