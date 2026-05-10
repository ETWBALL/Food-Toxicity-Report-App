/**
 * ALL /api/auth/*
 *
 * NextAuth.js catch‑all — legacy Credentials provider (`email`/`password`) wired in `app/auth.ts`.
 *
 * Most app flows use `/api/auth/login`, `/api/auth/register`, etc.; this handler remains for NextAuth compatibility.
 */
export { GET, POST } from 'app/auth';
