// Reserved for Scans orchestration steps 5-6 (drug labels + FAERS) in PR #2.
const FDA_BASE = 'https://api.fda.gov';
const FDA_KEY = process.env.OPENFDA_API_KEY;

function withKey(url: string): string {
  return FDA_KEY ? `${url}&api_key=${encodeURIComponent(FDA_KEY)}` : url;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type DrugLabel = {
  drug_interactions?: string[];
  warnings?: string[];
  active_ingredient?: string[];
  contraindications?: string[];
};

type DrugLabelResp = { results?: DrugLabel[] };

export async function fetchDrugLabel(medicationName: string): Promise<DrugLabel | null> {
  const q = encodeURIComponent(`openfda.brand_name:"${medicationName}" openfda.generic_name:"${medicationName}"`);
  const url = withKey(`${FDA_BASE}/drug/label.json?search=${q}&limit=1`);
  const json = await fetchJson<DrugLabelResp>(url);
  return json?.results?.[0] ?? null;
}

export type DrugFlag = {
  medication: string;
  interaction: string;
  matchedTerm: string;
};

export function detectDrugConflicts(
  medicationName: string,
  label: DrugLabel | null,
  ingredientsText: string | null,
): DrugFlag[] {
  if (!label?.drug_interactions || !ingredientsText) return [];
  const ingredientsLower = ingredientsText.toLowerCase();
  const flags: DrugFlag[] = [];
  for (const interaction of label.drug_interactions) {
    const head = interaction.split(/[—–\-]/)[0]?.trim().toLowerCase();
    if (!head || head.length < 3) continue;
    if (ingredientsLower.includes(head)) {
      flags.push({ medication: medicationName, interaction, matchedTerm: head });
    }
  }
  return flags;
}

export type FaersCount = {
  totalReports: number;
  topReactions: string[];
};

type FaersResp = {
  meta?: { results?: { total?: number } };
  results?: Array<{ patient?: { reaction?: Array<{ reactionmeddrapt?: string }> } }>;
};

export async function fetchFaersForMedication(medicationName: string): Promise<FaersCount | null> {
  const q = encodeURIComponent(`patient.drug.medicinalproduct:"${medicationName}"`);
  const url = withKey(`${FDA_BASE}/drug/event.json?search=${q}&limit=5&sort=receivedate:desc`);
  const json = await fetchJson<FaersResp>(url);
  if (!json) return null;
  const total = json.meta?.results?.total ?? 0;
  const reactions = (json.results ?? [])
    .flatMap((r) => r.patient?.reaction ?? [])
    .map((r) => r.reactionmeddrapt)
    .filter((s): s is string => Boolean(s))
    .slice(0, 3);
  return { totalReports: total, topReactions: reactions };
}
