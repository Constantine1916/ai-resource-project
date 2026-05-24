import { createSupabaseAdmin, type Article, type Source } from "@/lib/supabase-admin";
import {
  getEmailRecipient,
  getMissingSmtpConfig,
  hasSmtpConfig,
  sendEmail,
} from "@/lib/mailer";

type DeliveryRule = {
  id: string;
  slug: string;
  name: string;
  channel_type: "email";
  enabled: boolean;
  max_articles: number;
  lookback_hours: number;
  subject_prefix: string;
  last_sent_at: string | null;
};

type DigestArticle = Article & {
  source_name: string;
};

export type EmailDigestResult = {
  status: "success" | "failed" | "skipped";
  recipientEmail?: string;
  articleCount: number;
  subject?: string;
  message?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string | null) {
  if (!value) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

async function getDefaultRule() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("delivery_rules")
    .select("*")
    .eq("slug", "daily-email-digest")
    .single();

  if (error) {
    throw error;
  }

  return data as DeliveryRule;
}

async function createLog(ruleId: string, recipientEmail: string | null) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("delivery_logs")
    .insert({
      rule_id: ruleId,
      status: "running",
      recipient_email: recipientEmail,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

async function finishLog(
  logId: string,
  values: {
    status: "success" | "failed" | "skipped";
    articleCount: number;
    articleIds?: string[];
    subject?: string;
    errorMessage?: string;
  },
) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("delivery_logs")
    .update({
      status: values.status,
      article_count: values.articleCount,
      article_ids: values.articleIds ?? [],
      subject: values.subject ?? null,
      error_message: values.errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (error) {
    throw error;
  }
}

async function getPendingArticles(rule: DeliveryRule, recipientEmail: string) {
  const supabase = createSupabaseAdmin();
  const since = new Date(
    Date.now() - rule.lookback_hours * 60 * 60 * 1000,
  ).toISOString();

  const [sourcesResult, deliveredResult, articlesResult] = await Promise.all([
    supabase.from("sources").select("*"),
    supabase
      .from("article_deliveries")
      .select("article_id")
      .eq("rule_id", rule.id)
      .eq("recipient_email", recipientEmail)
      .limit(5000),
    supabase
      .from("articles")
      .select("*")
      .gte("first_seen_at", since)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("first_seen_at", { ascending: false })
      .limit(Math.max(rule.max_articles * 5, 50)),
  ]);

  if (sourcesResult.error) {
    throw sourcesResult.error;
  }

  if (deliveredResult.error) {
    throw deliveredResult.error;
  }

  if (articlesResult.error) {
    throw articlesResult.error;
  }

  const sources = (sourcesResult.data ?? []) as Source[];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const deliveredArticleIds = new Set(
    (deliveredResult.data ?? []).map((row) => row.article_id as string),
  );

  return ((articlesResult.data ?? []) as Article[])
    .filter((article) => !deliveredArticleIds.has(article.id))
    .slice(0, rule.max_articles)
    .map((article) => ({
      ...article,
      source_name: sourceById.get(article.source_id)?.name ?? "Unknown",
    }));
}

function buildSubject(rule: DeliveryRule, articles: DigestArticle[]) {
  const date = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(new Date());

  return `${rule.subject_prefix} - ${date} - ${articles.length} 条新资讯`;
}

function buildText(articles: DigestArticle[]) {
  return [
    `今日 AI 资讯更新 ${articles.length} 条`,
    "",
    ...articles.flatMap((article, index) => [
      `${index + 1}. ${article.title}`,
      `来源：${article.source_name}`,
      `时间：${formatDate(article.published_at || article.first_seen_at)}`,
      article.summary ? `摘要：${article.summary}` : "",
      `链接：${article.url}`,
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHtml(articles: DigestArticle[]) {
  const items = articles
    .map(
      (article, index) => `
        <tr>
          <td style="padding:18px 0;border-top:1px solid #e5e7eb;">
            <div style="font-size:12px;color:#667085;margin-bottom:6px;">
              ${index + 1}. ${escapeHtml(article.source_name)} · ${escapeHtml(
                formatDate(article.published_at || article.first_seen_at),
              )}
            </div>
            <a href="${escapeHtml(article.url)}" style="font-size:18px;line-height:1.45;font-weight:700;color:#111827;text-decoration:none;">
              ${escapeHtml(article.title)}
            </a>
            ${
              article.summary
                ? `<p style="font-size:14px;line-height:1.7;color:#4b5563;margin:8px 0 0;">${escapeHtml(article.summary)}</p>`
                : ""
            }
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f7f8f5;font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;color:#111827;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8f5;padding:24px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #d8ddcf;border-radius:8px;padding:28px;">
                <tr>
                  <td>
                    <div style="font-size:13px;color:#667085;text-transform:uppercase;">AI Resource Project</div>
                    <h1 style="font-size:26px;line-height:1.3;margin:8px 0 4px;color:#111827;">今日 AI 资讯更新 ${articles.length} 条</h1>
                    <p style="font-size:14px;color:#667085;margin:0 0 18px;">由 Vercel Cron 自动抓取并推送</p>
                  </td>
                </tr>
                ${items}
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export async function runEmailDigest(): Promise<EmailDigestResult> {
  const supabase = createSupabaseAdmin();
  const rule = await getDefaultRule();
  const recipientEmail = process.env.DIGEST_TO_EMAIL || null;
  const logId = await createLog(rule.id, recipientEmail);

  try {
    if (!rule.enabled) {
      await finishLog(logId, {
        status: "skipped",
        articleCount: 0,
        errorMessage: "Delivery rule is disabled.",
      });

      return {
        status: "skipped",
        articleCount: 0,
        message: "Delivery rule is disabled.",
      };
    }

    const resolvedRecipientEmail = getEmailRecipient();

    if (!hasSmtpConfig()) {
      const missingConfig = getMissingSmtpConfig().join(", ");
      throw new Error(
        `SMTP is not fully configured. Missing: ${missingConfig}.`,
      );
    }

    const articles = await getPendingArticles(rule, resolvedRecipientEmail);
    const articleIds = articles.map((article) => article.id);

    if (articles.length === 0) {
      await finishLog(logId, {
        status: "skipped",
        articleCount: 0,
        errorMessage: "No new articles to deliver.",
      });

      return {
        status: "skipped",
        recipientEmail: resolvedRecipientEmail,
        articleCount: 0,
        message: "No new articles to deliver.",
      };
    }

    const subject = buildSubject(rule, articles);

    await sendEmail({
      to: resolvedRecipientEmail,
      subject,
      text: buildText(articles),
      html: buildHtml(articles),
    });

    const deliveries = articles.map((article) => ({
      article_id: article.id,
      rule_id: rule.id,
      recipient_email: resolvedRecipientEmail,
    }));

    const { error: deliveriesError } = await supabase
      .from("article_deliveries")
      .upsert(deliveries, {
        onConflict: "article_id,rule_id,recipient_email",
        ignoreDuplicates: true,
      });

    if (deliveriesError) {
      throw deliveriesError;
    }

    const { error: ruleError } = await supabase
      .from("delivery_rules")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", rule.id);

    if (ruleError) {
      throw ruleError;
    }

    await finishLog(logId, {
      status: "success",
      articleCount: articles.length,
      articleIds,
      subject,
    });

    return {
      status: "success",
      recipientEmail: resolvedRecipientEmail,
      articleCount: articles.length,
      subject,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";

    await finishLog(logId, {
      status: "failed",
      articleCount: 0,
      errorMessage: message,
    });

    return {
      status: "failed",
      recipientEmail: recipientEmail ?? undefined,
      articleCount: 0,
      message,
    };
  }
}
