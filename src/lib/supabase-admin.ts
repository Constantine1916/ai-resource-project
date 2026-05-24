import { createClient } from "@supabase/supabase-js";

export type Source = {
  id: string;
  slug: string;
  name: string;
  feed_url: string;
  site_url: string | null;
  source_type: "rss";
  description: string | null;
  enabled: boolean;
  fetch_interval_minutes: number;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Article = {
  id: string;
  source_id: string;
  title: string;
  url: string;
  url_hash: string;
  guid: string | null;
  author: string | null;
  summary: string | null;
  published_at: string | null;
  raw_item: Record<string, unknown>;
  first_seen_at: string;
  created_at: string;
  updated_at: string;
};

export type CrawlRun = {
  id: string;
  source_id: string | null;
  status: "running" | "success" | "failed";
  fetched_count: number;
  inserted_count: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export function hasSupabaseAdminConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
