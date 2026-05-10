import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, ok, parseId, validationError } from '../../_lib/http';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return badRequest('invalid product id');
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return notFound('product not found');
  return ok(product);
}

const PutProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    brand: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    manufacturer: z.string().nullable().optional(),
    countryOfOrigin: z.string().nullable().optional(),
    servingSize: z.string().nullable().optional(),
    ingredientList: z.string().nullable().optional(),
    nutritionalInfo: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
  })
  .strict();

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return badRequest('invalid product id');
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== 'object') return badRequest('invalid body');
  const parsed = PutProductSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error.issues);

  const data = parsed.data;
  const updates: Record<string, unknown> = {};
  for (const key of [
    'name',
    'brand',
    'description',
    'manufacturer',
    'countryOfOrigin',
    'servingSize',
    'ingredientList',
    'imageUrl',
    'type',
  ] as const) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  if (data.nutritionalInfo !== undefined) {
    updates.nutritionalInfo =
      data.nutritionalInfo === null
        ? null
        : typeof data.nutritionalInfo === 'string'
          ? data.nutritionalInfo
          : JSON.stringify(data.nutritionalInfo);
  }

  try {
    const product = await prisma.product.update({ where: { id }, data: updates });
    return ok(product);
  } catch {
    return notFound('product not found');
  }
}
