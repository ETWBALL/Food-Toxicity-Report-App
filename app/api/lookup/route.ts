import { NextResponse } from 'next/server';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const FDA_BASE = 'https://api.fda.gov/drug/label.json';

type LookupBody = {
  category?: 'food' | 'medication';
  barcode?: string;
  name?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LookupBody | null;

  if (!body?.category) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 });
  }

  if (body.category === 'food') {
    if (!body.barcode) {
      return NextResponse.json({ error: 'barcode is required for food' }, { status: 400 });
    }
    const url = `${OFF_BASE}/${encodeURIComponent(body.barcode)}.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: 'Open Food Facts lookup failed' }, { status: 502 });
    }
    const json = await res.json();
    return NextResponse.json({ category: 'food', source: 'openfoodfacts', data: json });
  }

  if (!body.name) {
    return NextResponse.json({ error: 'name is required for medication' }, { status: 400 });
  }

  const query = `openfda.brand_name:"${body.name}"`;
  const url = `${FDA_BASE}?search=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    return NextResponse.json({ error: 'FDA label lookup failed' }, { status: 502 });
  }
  const json = await res.json();
  return NextResponse.json({ category: 'medication', source: 'fda', data: json });
}
