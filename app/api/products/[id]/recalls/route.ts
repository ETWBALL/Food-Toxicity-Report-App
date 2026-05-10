import { prisma } from '@/lib/prisma';
import { badRequest, ok, parseId } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const productId = parseId(params.id);
  if (!productId) return badRequest('invalid product id');

  const u = new URL(req.url);
  const activeOnly = u.searchParams.get('activeOnly') !== 'false';

  // Fetch product first to know barcodeNumber for affectedUpcCodes substring match.
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { barcodeNumber: true },
  });
  const barcode = product?.barcodeNumber ?? null;

  // affectedUpcCodes is TEXT (per Prisma migration), not TEXT[]. Use substring match.
  const recalls = await prisma.recall.findMany({
    where: {
      ...(activeOnly ? { active: true } : {}),
      OR: [
        { productId },
        ...(barcode ? [{ affectedUpcCodes: { contains: barcode } }] : []),
      ],
    },
    orderBy: [{ recallDate: 'desc' }, { id: 'desc' }],
  });

  const activeRecalls = recalls.filter((r) => r.active).length;

  return ok({ productId, activeRecalls, recalls });
}
