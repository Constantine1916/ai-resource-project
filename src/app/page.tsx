import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "success") {
    return "成功";
  }

  if (status === "failed") {
    return "失败";
  }

  return "运行中";
}

export default async function Home() {
  const data = await getDashboardData();
  const latestRun = data.crawlRuns[0];
  const successfulRuns = data.crawlRuns.filter(
    (run) => run.status === "success",
  ).length;

  const metrics = [
    {
      label: "RSS 源",
      value: data.sources.length.toString(),
      subtext: `${data.sources.filter((source) => source.enabled).length} 个启用`,
    },
    {
      label: "已入库文章",
      value: data.articles.length.toString(),
      subtext: "最近 30 条",
    },
    {
      label: "最近抓取",
      value: latestRun ? statusLabel(latestRun.status) : "未运行",
      subtext: latestRun ? formatDate(latestRun.started_at) : "等待首次抓取",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#1d211b]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-[#d8ddcf] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-[#68715d]">
              AI Resource Project
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#161915] sm:text-4xl">
              AI 资讯聚合工作台
            </h1>
          </div>
          <div className="rounded-md border border-[#d8ddcf] bg-white px-4 py-3 text-sm text-[#4d5747] shadow-sm">
            Cron: 每日 08:00 北京时间自动抓取
          </div>
        </header>

        {!data.configured ? (
          <section className="rounded-md border border-[#e0c7aa] bg-[#fff8ed] p-5 text-sm text-[#65410f]">
            Supabase 环境变量尚未配置，部署后会自动读取生产配置。
          </section>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-[#d8ddcf] bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-[#68715d]">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold">{metric.value}</p>
              <p className="mt-2 text-sm text-[#68715d]">{metric.subtext}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
          <div className="flex flex-col gap-6">
            <div className="rounded-md border border-[#d8ddcf] bg-white shadow-sm">
              <div className="border-b border-[#e4e8dd] px-5 py-4">
                <h2 className="text-lg font-semibold">RSS 源</h2>
              </div>
              <div className="divide-y divide-[#edf0e8]">
                {data.sources.map((source) => (
                  <div key={source.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <a
                          className="mt-1 block break-all text-sm text-[#315c8c] hover:underline"
                          href={source.feed_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {source.feed_url}
                        </a>
                      </div>
                      <span className="rounded bg-[#e9f4df] px-2.5 py-1 text-xs font-medium text-[#233516]">
                        {source.enabled ? "启用" : "停用"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#68715d]">
                      上次抓取：{formatDate(source.last_fetched_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-[#d8ddcf] bg-white shadow-sm">
              <div className="border-b border-[#e4e8dd] px-5 py-4">
                <h2 className="text-lg font-semibold">抓取日志</h2>
              </div>
              <div className="divide-y divide-[#edf0e8]">
                {data.crawlRuns.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-[#68715d]">
                    暂无抓取记录。
                  </p>
                ) : (
                  data.crawlRuns.map((run) => (
                    <div key={run.id} className="px-5 py-4 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium">
                          {run.source_name ?? "Unknown source"}
                        </p>
                        <span
                          className={
                            run.status === "failed"
                              ? "text-[#9a3412]"
                              : "text-[#2d5a23]"
                          }
                        >
                          {statusLabel(run.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-[#68715d]">
                        {formatDate(run.started_at)}，抓取 {run.fetched_count}{" "}
                        条，新增 {run.inserted_count} 条
                      </p>
                      {run.error_message ? (
                        <p className="mt-2 text-[#9a3412]">{run.error_message}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[#d8ddcf] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-[#e4e8dd] px-5 py-4">
              <h2 className="text-lg font-semibold">最新文章</h2>
              <p className="text-sm text-[#68715d]">
                最近成功抓取 {successfulRuns} 次
              </p>
            </div>
            <div className="divide-y divide-[#edf0e8]">
              {data.articles.length === 0 ? (
                <p className="px-5 py-4 text-sm text-[#68715d]">
                  暂无文章，首次抓取后会显示在这里。
                </p>
              ) : (
                data.articles.map((article) => (
                  <article key={article.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#68715d]">
                      <span className="rounded bg-[#eef2e9] px-2 py-1">
                        {article.source_name}
                      </span>
                      <span>{formatDate(article.published_at)}</span>
                    </div>
                    <a
                      className="mt-2 block text-lg font-semibold leading-snug text-[#182017] hover:text-[#315c8c]"
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {article.title}
                    </a>
                    {article.summary ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#4d5747]">
                        {article.summary}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
