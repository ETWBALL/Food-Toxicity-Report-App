import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/proxy';
import type { User } from '@prisma/client';
import { badRequest, notFound, ok, parseId } from '../../../../_lib/http';
import { verdictFromScore } from '../../../../_lib/score';

export const dynamic = 'force-dynamic';

function parseUserRef(raw: string): { id: number } | { publicId: string } {
  if (/^\d+$/.test(raw)) {
    const id = Number(raw);
    if (id > 0) return { id };
  }
  return { publicId: raw };
}

function refMatchesCaller(ref: ReturnType<typeof parseUserRef>, caller: User): boolean {
  if ('id' in ref) return caller.id === ref.id;
  return caller.publicId === ref.publicId;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string; scanId: string } },
) {
  return requireAuth(req, async (caller) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const scanId = parseId(params.scanId);
    if (!scanId) return badRequest('invalid scan id');

    const scan = await prisma.scanHistory.findFirst({
      where: { id: scanId, userId: caller.id },
      include: {
        product: true,
        safetyReports: { orderBy: { reportDate: 'desc' }, take: 1 },
      },
    });
    if (!scan) return notFound('scan not found');

    const report = scan.safetyReports[0] ?? null;
    return ok({
      scanId: scan.id,
      scannedAt: scan.scannedAt,
      safetyScore: scan.safetyScore,
      verdict: verdictFromScore(scan.safetyScore),
      product: scan.product
        ? { id: scan.product.id, name: scan.product.name, imageUrl: scan.product.imageUrl }
        : null,
      report: report
        ? {
            id: report.id,
            overallScore: report.overallScore,
            severityLevel: report.severityLevel,
            allergenFlags: report.allergenFlags,
            drugFlags: report.drugFlags,
            toxicityFlags: report.toxicityFlags,
            potentialHarms: report.potentialHarms,
            aiAnalysisSummary: report.aiAnalysisSummary,
            isPersonalized: report.isPersonalized,
          }
        : null,
    });
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; scanId: string } },
) {
  return requireAuth(req, async (caller) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const scanId = parseId(params.scanId);
    if (!scanId) return badRequest('invalid scan id');

    // Verify ownership before deleting (prisma.delete by composite where would
    // need a unique compound; cheaper to read first then delete).
    const found = await prisma.scanHistory.findFirst({
      where: { id: scanId, userId: caller.id },
      select: { id: true },
    });
    if (!found) return notFound('scan not found');

    // Cascade safety_reports first (FK is ON DELETE SET NULL per migration —
    // but for the user-experience promise of "delete also removes report",
    // we explicitly drop reports tied to this scan).
    await prisma.$transaction([
      prisma.safetyReport.deleteMany({ where: { scanId } }),
      prisma.scanHistory.delete({ where: { id: scanId } }),
    ]);

    return ok({ success: true, scanId });
  });
}
