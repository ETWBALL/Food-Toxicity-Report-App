import { NextResponse } from 'next/server';

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
