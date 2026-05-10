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
      isActive: true,
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
