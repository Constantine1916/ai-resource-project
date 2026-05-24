import { createHash } from "node:crypto";
import Parser from "rss-parser";

import { createSupabaseAdmin, type Source } from "@/lib/supabase-admin";

type RssItem = Parser.Item & {
  author?: string;
  creator?: string;
  content?: string;
  contentSnippet?: string;
  isoDate?: string;
  summary?: string;
};

type ArticleRow = {
  source_id: string;
  title: string;
  url: string;
  url_hash: string;
  guid: string | null;
  author: string | null;
  summary: string | null;
  published_at: string | null;
  raw_item: Record<string, unknown>;
};

export type SourceCrawlResult = {
  source: {
    id: string;
    slug: string;
    name: string;
    feed_url: string;
  };
  status: "success" | "failed";
  fetchedCount: number;
  insertedCount: number;
  error?: string;
};

const parser = new Parser<Record<string, unknown>, RssItem>({
  timeout: 60000,
  headers: {
    "User-Agent":
      "AIResourceProject/0.1 (+https://github.com/Constantine1916/ai-resource-project)",
    Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  },
});

function normalizeUrl(value: string | undefined) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value.trim()).toString();
  } catch {
    return value.trim();
  }
}

function cleanText(value: string | undefined, maxLength = 600) {
  if (!value) {
    return null;
  }

  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return null;
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function toIsoDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function itemToArticleRow(source: Source, item: RssItem): ArticleRow | null {
  const title = cleanText(item.title, 300);
  const url = normalizeUrl(item.link || item.guid);

  if (!title || !url) {
    return null;
  }

  const dedupeKey = normalizeUrl(item.link) || `${source.slug}:${item.guid || title}`;

  return {
    source_id: source.id,
    title,
    url,
    url_hash: hashValue(dedupeKey),
    guid: item.guid || null,
    author: item.creator || item.author || null,
    summary: cleanText(item.contentSnippet || item.content || item.summary),
    published_at: toIsoDate(item.isoDate || item.pubDate),
    raw_item: JSON.parse(JSON.stringify(item)) as Record<string, unknown>,
  };
}

async function createRun(sourceId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("crawl_runs")
    .insert({ source_id: sourceId, status: "running" })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

async function finishRun(
  runId: string,
  status: "success" | "failed",
  fetchedCount: number,
  insertedCount: number,
  errorMessage?: string,
) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("crawl_runs")
    .update({
      status,
      fetched_count: fetchedCount,
      inserted_count: insertedCount,
      error_message: errorMessage || null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throw error;
  }
}

export async function crawlSource(source: Source): Promise<SourceCrawlResult> {
  const supabase = createSupabaseAdmin();
  const runId = await createRun(source.id);

  try {
    const feed = await parser.parseURL(source.feed_url);
    const rows = feed.items
      .map((item) => itemToArticleRow(source, item))
      .filter((row): row is ArticleRow => Boolean(row));

    let insertedCount = 0;

    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("articles")
        .upsert(rows, {
          onConflict: "url_hash",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) {
        throw error;
      }

      insertedCount = data?.length ?? 0;
    }

    const now = new Date().toISOString();
    const { error: sourceError } = await supabase
      .from("sources")
      .update({ last_fetched_at: now })
      .eq("id", source.id);

    if (sourceError) {
      throw sourceError;
    }

    await finishRun(runId, "success", rows.length, insertedCount);

    return {
      source: {
        id: source.id,
        slug: source.slug,
        name: source.name,
        feed_url: source.feed_url,
      },
      status: "success",
      fetchedCount: rows.length,
      insertedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown crawl error";
    await finishRun(runId, "failed", 0, 0, message);

    return {
      source: {
        id: source.id,
        slug: source.slug,
        name: source.name,
        feed_url: source.feed_url,
      },
      status: "failed",
      fetchedCount: 0,
      insertedCount: 0,
      error: message,
    };
  }
}

export async function crawlEnabledSources() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("enabled", true)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  const sources = (data ?? []) as Source[];
  return Promise.all(sources.map((source) => crawlSource(source)));
}
