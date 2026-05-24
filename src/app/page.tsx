const sources = [
  {
    name: "OpenAI Blog",
    type: "RSS",
    status: "Ready",
    cadence: "Hourly",
  },
  {
    name: "Anthropic News",
    type: "RSS",
    status: "Ready",
    cadence: "Hourly",
  },
  {
    name: "GitHub Releases",
    type: "API",
    status: "Planned",
    cadence: "Daily",
  },
];

const metrics = [
  { label: "Sources", value: "3", tone: "bg-[#e9f4df] text-[#233516]" },
  { label: "New items", value: "0", tone: "bg-[#e7eef8] text-[#172b47]" },
  { label: "Email digests", value: "0", tone: "bg-[#f5ece0] text-[#402b16]" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#1d211b]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-[#d8ddcf] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.08em] text-[#68715d]">
              AI Resource Project
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#161915] sm:text-4xl">
              AI 资讯聚合与邮件推送工作台
            </h1>
          </div>
          <div className="rounded-md border border-[#d8ddcf] bg-white px-4 py-3 text-sm text-[#4d5747] shadow-sm">
            MVP: RSS 抓取、去重入库、定时邮件推送
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-[#d8ddcf] bg-white p-5 shadow-sm"
            >
              <p className="text-sm text-[#68715d]">{metric.label}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-3xl font-semibold">{metric.value}</span>
                <span className={`rounded px-2.5 py-1 text-xs ${metric.tone}`}>
                  MVP
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-md border border-[#d8ddcf] bg-white shadow-sm">
            <div className="border-b border-[#e4e8dd] px-5 py-4">
              <h2 className="text-lg font-semibold">Source Pipeline</h2>
            </div>
            <div className="divide-y divide-[#edf0e8]">
              {sources.map((source) => (
                <div
                  key={source.name}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto]"
                >
                  <div>
                    <p className="font-medium">{source.name}</p>
                    <p className="text-sm text-[#68715d]">{source.type}</p>
                  </div>
                  <p className="text-sm text-[#4d5747]">{source.cadence}</p>
                  <p className="text-sm font-medium text-[#2d5a23]">
                    {source.status}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[#d8ddcf] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Build Plan</h2>
            <ol className="mt-4 space-y-3 text-sm text-[#4d5747]">
              <li>1. Supabase schema and source management.</li>
              <li>2. Vercel Cron crawl route.</li>
              <li>3. Email digest route and delivery logs.</li>
              <li>4. GitHub push to main triggers CI and Vercel build.</li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
