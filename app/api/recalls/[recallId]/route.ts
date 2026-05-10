/**
 * GET /api/recalls/:recallId
 *
 * Public single recall by numeric id. `200` row JSON; `400` invalid id; `404` not found.
 */
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, ok, parseId } from '../../_lib/http';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: { recallId: string } }) {
  const recallId = parseId(params.recallId);
  if (!recallId) return badRequest('invalid recall id');
  const recall = await prisma.recall.findUnique({ where: { id: recallId } });
  if (!recall) return notFound('recall not found');
  return ok(recall);
}
