/**
 * GET /api/users/:id/reports
 *
 * Lists the caller’s safety reports (up to 100, newest first). Requires session; `:id` must match the caller (numeric id or `publicId`).
 *
 * Success `200`: JSON array of full report objects (via `fullSafetyReportJson`).
 *
 * Errors: `401` unauthenticated, `403` user ref mismatch.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/proxy';
import { parseUserRef, refMatchesCaller } from '@/lib/auth/user-ref';
import { fullSafetyReportJson } from '@/lib/reports/safety-report-response';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reports = await prisma.safetyReport.findMany({
      where: { userId: caller.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(reports.map((r) => fullSafetyReportJson(r)));
  });
}
