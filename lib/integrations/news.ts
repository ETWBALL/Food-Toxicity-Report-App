import { fetchJson } from '@/lib/integrations/fetch';

export type NewsArticle = {
  title: string;
  url: string;
  publishedAt?: string;
  source?: string;
};

/**
 * Uses NewsAPI.org when NEWS_API_KEY is set; otherwise returns empty (caller continues pipeline).
 */
export async function fetchLatestNews(query: string): Promise<NewsArticle[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key || !query.trim()) {
    return [];
  }

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=10&language=en&apiKey=${encodeURIComponent(key)}`;
  const res = await fetchJson<{
    status: string;
    articles?: { title: string; url: string; publishedAt?: string; source?: { name?: string } }[];
  }>(url, { timeoutMs: 10_000 });

  if (!res.ok || res.data.status !== 'ok' || !res.data.articles?.length) {
    return [];
  }

  return res.data.articles.map((a) => ({
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
    source: a.source?.name,
  }));
}
