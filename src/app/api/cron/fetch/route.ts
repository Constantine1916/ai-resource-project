import { NextResponse, type NextRequest } from "next/server";

import { crawlEnabledSources } from "@/lib/rss-crawler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return authorization === `Bearer ${cronSecret}` || querySecret === cronSecret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const results = await crawlEnabledSources();
  const failedCount = results.filter((result) => result.status === "failed").length;

  return NextResponse.json(
    {
      startedAt,
      finishedAt: new Date().toISOString(),
      sourceCount: results.length,
      failedCount,
      insertedCount: results.reduce(
        (total, result) => total + result.insertedCount,
        0,
      ),
      results,
    },
    { status: failedCount > 0 ? 207 : 200 },
  );
}

export async function POST(request: NextRequest) {
  return GET(request);
}
