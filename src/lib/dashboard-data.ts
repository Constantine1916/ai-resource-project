import {
  createSupabaseAdmin,
  hasSupabaseAdminConfig,
  type Article,
  type CrawlRun,
  type Source,
} from "@/lib/supabase-admin";

export type DashboardData = {
  configured: boolean;
  sources: Source[];
  articles: Array<Article & { source_name: string; source_slug: string }>;
  crawlRuns: Array<CrawlRun & { source_name: string | null }>;
};

export async function getDashboardData(): Promise<DashboardData> {
  if (!hasSupabaseAdminConfig()) {
    return {
      configured: false,
      sources: [],
      articles: [],
      crawlRuns: [],
    };
  }

  const supabase = createSupabaseAdmin();

  const [sourcesResult, articlesResult, runsResult] = await Promise.all([
    supabase.from("sources").select("*").order("name", { ascending: true }),
    supabase
      .from("articles")
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("first_seen_at", { ascending: false })
      .limit(30),
    supabase
      .from("crawl_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  if (sourcesResult.error) {
    throw sourcesResult.error;
  }

  if (articlesResult.error) {
    throw articlesResult.error;
  }

  if (runsResult.error) {
    throw runsResult.error;
  }

  const sources = (sourcesResult.data ?? []) as Source[];
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return {
    configured: true,
    sources,
    articles: ((articlesResult.data ?? []) as Article[]).map((article) => {
      const source = sourceById.get(article.source_id);

      return {
        ...article,
        source_name: source?.name ?? "Unknown",
        source_slug: source?.slug ?? "unknown",
      };
    }),
    crawlRuns: ((runsResult.data ?? []) as CrawlRun[]).map((run) => {
      const source = run.source_id ? sourceById.get(run.source_id) : null;

      return {
        ...run,
        source_name: source?.name ?? null,
      };
    }),
  };
}
