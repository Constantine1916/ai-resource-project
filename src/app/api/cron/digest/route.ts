import { NextResponse, type NextRequest } from "next/server";

import { runEmailDigest } from "@/lib/email-digest";

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

  const result = await runEmailDigest();

  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
