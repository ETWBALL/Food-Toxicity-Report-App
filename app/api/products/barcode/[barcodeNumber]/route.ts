/**
 * GET /api/products/barcode/:barcodeNumber
 *
 * Resolves product by barcode: returns DB cache if present, otherwise fetches Open Food Facts and upserts.
 *
 * Success `200`: product fields + `{ source: 'cache' | 'openfoodfacts' }`.
 *
 * `404` if OFF has no match (`product not in catalog`).
 */
import { prisma } from '@/lib/prisma';
import { notFound, ok } from '../../../_lib/http';
import { fetchProductByBarcode, mapOffToProduct } from '../../../_lib/openfoodfacts';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { barcodeNumber: string } }) {
  const bc = params.barcodeNumber;

  const cached = await prisma.product.findUnique({ where: { barcodeNumber: bc } });
  if (cached) return ok({ ...cached, source: 'cache' });

  const off = await fetchProductByBarcode(bc);
  if (!off) return notFound('product not in catalog');

  const data = mapOffToProduct(bc, off);
  const upserted = await prisma.product.upsert({
    where: { barcodeNumber: bc },
    create: data,
    update: {
      name: data.name,
      brand: data.brand ?? undefined,
      type: data.type ?? undefined,
      ingredientList: data.ingredientList ?? undefined,
      nutritionalInfo: data.nutritionalInfo ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
    },
  });
  return ok({ ...upserted, source: 'openfoodfacts' });
}
