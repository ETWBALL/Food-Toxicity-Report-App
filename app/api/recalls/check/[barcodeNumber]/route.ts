/**
 * POST /api/recalls/check/:barcodeNumber
 *
 * Checks active recalls for a barcode: matches `productId` when the barcode exists in `products`, and substring match on `affectedUpcCodes`.
 *
 * No auth required. Success `200`:
 * `{ barcodeNumber, hasRecall, worstSeverity, activeRecallCount, recalls }`.
 */
import { prisma } from '@/lib/prisma';
import { ok } from '../../../_lib/http';
import { worstSeverity } from '../../../_lib/score';

export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: { barcodeNumber: string } }) {
  const bc = params.barcodeNumber;

  // Find product first (for productId match) — gracefully handle unknown barcodes.
  const product = await prisma.product.findUnique({
    where: { barcodeNumber: bc },
    select: { id: true },
  });

  const recalls = await prisma.recall.findMany({
    where: {
      active: true,
      OR: [
        ...(product ? [{ productId: product.id }] : []),
        { affectedUpcCodes: { contains: bc } },
      ],
    },
    orderBy: [{ recallDate: 'desc' }],
  });

  return ok({
    barcodeNumber: bc,
    hasRecall: recalls.length > 0,
    worstSeverity: worstSeverity(recalls.map((r) => r.severityLevel)),
    activeRecallCount: recalls.length,
    recalls,
  });
}
