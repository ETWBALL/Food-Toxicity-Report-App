import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/proxy';
import type { User } from '@prisma/client';
import { ok, validationError } from '../../../_lib/http';
import { computeScore, verdictFromScore, worstSeverity } from '../../../_lib/score';
import { fetchProductByBarcode, mapOffToProduct } from '../../../_lib/openfoodfacts';
import { fetchDrugLabel, detectDrugConflicts, type DrugFlag } from '../../../_lib/fda';
import { generateScanSummary } from '../../../_lib/ai';

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

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

const PostScanSchema = z.object({
  barcodeNumber: z.string().min(1),
});

async function resolveProductByBarcode(bc: string) {
  const cached = await prisma.product.findUnique({ where: { barcodeNumber: bc } });
  if (cached) return cached;
  const off = await fetchProductByBarcode(bc);
  if (!off) return null;
  const data = mapOffToProduct(bc, off);
  return prisma.product.upsert({
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
}

function detectAllergyFlags(allergens: string[], ingredientsText: string | null): string[] {
  if (!ingredientsText) return [];
  const lc = ingredientsText.toLowerCase();
  return allergens.filter((a) => {
    const term = a.toLowerCase().trim();
    if (term.length < 3) return false;
    return lc.includes(term);
  });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const u = new URL(req.url);
    const rawLimit = Number.parseInt(u.searchParams.get('limit') ?? '20', 10);
    const rawOffset = Number.parseInt(u.searchParams.get('offset') ?? '0', 10);
    const limit = Number.isFinite(rawLimit) ? clamp(rawLimit, 1, 100) : 20;
    const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

    const where = { userId: caller.id };

    const [scans, total] = await Promise.all([
      prisma.scanHistory.findMany({
        where,
        orderBy: [{ scannedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
        },
      }),
      prisma.scanHistory.count({ where }),
    ]);

    const items = scans.map((s) => ({
      id: s.id,
      productId: s.productId,
      productName: s.product?.name ?? null,
      productImage: s.product?.imageUrl ?? null,
      safetyScore: s.safetyScore,
      verdict: verdictFromScore(s.safetyScore),
      scannedAt: s.scannedAt,
    }));

    return ok({ total, limit, offset, scans: items });
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return requireAuth(req, async (caller) => {
    const ref = parseUserRef(params.id);
    if (!refMatchesCaller(ref, caller)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = PostScanSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error.issues);
    const { barcodeNumber } = parsed.data;

    // Step 2-3: resolve product (cache → OFF → upsert)
    const product = await resolveProductByBarcode(barcodeNumber);
    if (!product) {
      return NextResponse.json(
        { error: 'Product not in catalog', code: 'PRODUCT_NOT_IN_CATALOG' },
        { status: 404 },
      );
    }

    // Step 4: active recalls for this product
    const activeRecalls = await prisma.recall.findMany({
      where: {
        isActive: true,
        OR: [
          { productId: product.id },
          { affectedUpcCodes: { contains: barcodeNumber } },
        ],
      },
      orderBy: [{ recallDate: 'desc' }],
    });
    const recallActive = activeRecalls.length > 0;
    const recallSeverity = worstSeverity(activeRecalls.map((r) => r.severityLevel));
    const officialRecallUrl = activeRecalls[0]?.officialRecallUrl ?? null;

    // Step 5: allergen cross-reference
    const allergies = await prisma.userAllergy.findMany({
      where: { userId: caller.id },
      select: { allergen: true },
    });
    const allergyFlags = detectAllergyFlags(
      allergies.map((a) => a.allergen),
      product.ingredientList,
    );

    // Step 6: drug interaction check (one FDA call per medication)
    const medications = await prisma.userMedication.findMany({
      where: { userId: caller.id },
      select: { medicationName: true },
    });
    const drugFlags: DrugFlag[] = [];
    for (const med of medications) {
      const label = await fetchDrugLabel(med.medicationName);
      drugFlags.push(...detectDrugConflicts(med.medicationName, label, product.ingredientList));
    }

    const userProfileExists = allergies.length + medications.length > 0;

    // Step 7: deterministic score
    const { score, verdict, isPersonalized } = computeScore({
      recallActive,
      recallSeverity,
      allergyFlags,
      drugFlags: drugFlags.map((f) => f.interaction),
      userProfileExists,
    });

    // Step 8: AI summary (with deterministic fallback) + transactional write
    const baseUrl = new URL(req.url).origin;
    const drugFlagsForAi = drugFlags.map((f) => ({
      medication: f.medication,
      interaction: f.interaction,
    }));
    const summary = await generateScanSummary(
      {
        productName: product.name,
        score,
        verdict,
        recallActive,
        recallSeverity,
        allergyFlags,
        drugFlags: drugFlagsForAi,
      },
      baseUrl,
    );

    const [scan] = await prisma.$transaction(async (tx) => {
      const created = await tx.scanHistory.create({
        data: { userId: caller.id, productId: product.id, safetyScore: score },
      });
      const reportRow = await tx.safetyReport.create({
        data: {
          userId: caller.id,
          productId: product.id,
          scanId: created.id,
          overallScore: score,
          severityLevel: recallSeverity,
          isPersonalized,
          allergenFlags: JSON.stringify(allergyFlags),
          drugFlags: JSON.stringify(drugFlagsForAi),
          aiAnalysisSummary: summary,
        },
      });
      return [created, reportRow];
    });

    return ok(
      {
        scanId: scan.id,
        productId: product.id,
        product: { id: product.id, name: product.name, imageUrl: product.imageUrl },
        safetyScore: score,
        verdict,
        recallActive,
        recallSeverity,
        allergyFlags,
        drugFlags: drugFlags.map((f) => `${f.medication} × ${f.matchedTerm}`),
        summary,
        officialRecallUrl,
        scannedAt: scan.scannedAt,
        isPersonalized,
      },
      201,
    );
  });
}
