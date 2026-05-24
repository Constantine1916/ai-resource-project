# AI Pulse 实现方案学习笔记

## 项目定位

`ai-pulse` 是一个轻量级 AI 资讯聚合与邮件摘要 MVP。它的核心目标不是做 AI 总结或推荐，而是先把资讯采集、去重、入库、展示、定时推送这条基础链路跑通。

当前实现可以概括为：

```text
RSS 源配置
  -> 定时抓取接口
  -> 解析 RSS
  -> 文章去重入库
  -> Dashboard 展示
  -> 定时邮件摘要
  -> 记录抓取与推送日志
```

## 技术栈

- App framework: Next.js 16 + App Router
- Language: TypeScript
- UI: Tailwind CSS
- Database: Supabase Postgres
- RSS parser: `rss-parser`
- Email provider: Resend API 风格的邮件发送
- Scheduler: Vercel Cron Jobs
- Package manager: pnpm
- Runtime requirement: Node.js 22.x

## 目录结构重点

```text
src/app/page.tsx
  Dashboard 页面入口

src/app/api/cron/fetch/route.ts
  RSS 抓取 cron API

src/app/api/cron/digest/route.ts
  邮件摘要 cron API

src/lib/rss-crawler.ts
  RSS 抓取、解析、去重、入库逻辑

src/lib/dashboard-data.ts
  Dashboard 所需数据查询

src/lib/email-digest.ts
  邮件摘要规则、待发送文章查询、发送记录逻辑

src/lib/mailer.ts
  邮件发送封装

src/lib/supabase-admin.ts
  Supabase service role client

supabase/migrations/
  数据表、索引、初始数据迁移 SQL
```

## 数据库设计

项目把采集链路和推送链路分成两组表。

RSS 采集相关：

```text
sources
  保存 RSS 源配置，例如 36Kr、Hacker News、AIHOT

articles
  保存抓取到的文章

crawl_runs
  保存每次抓取任务的运行日志
```

邮件推送相关：

```text
delivery_rules
  保存推送规则，例如每日邮件摘要、最大文章数、回看时间

delivery_logs
  保存每次邮件推送任务的结果

article_deliveries
  记录某篇文章是否已经发给某个收件人，用于避免重复推送
```

其中 `articles.url_hash` 是去重关键字段。抓取 RSS 时会根据文章 URL 或 fallback key 生成 SHA-256 hash，然后通过 Supabase upsert 的 `onConflict: "url_hash"` 防止重复入库。

## RSS 抓取流程

抓取入口是：

```text
GET /api/cron/fetch
POST /api/cron/fetch
```

接口鉴权逻辑在 `src/app/api/cron/fetch/route.ts`：

```text
Authorization: Bearer $CRON_SECRET
```

本地开发时，如果没有配置 `CRON_SECRET`，非生产环境会允许请求。生产环境必须配置 secret。

实际抓取逻辑在 `src/lib/rss-crawler.ts`：

1. 查询 `sources` 表里 `enabled = true` 的 RSS 源。
2. 为每个源创建一条 `crawl_runs` running 记录。
3. 使用 `rss-parser` 请求并解析 `source.feed_url`。
4. 将 RSS item 转成 `articles` 表需要的行数据。
5. 清洗标题、摘要、发布时间，并保存原始 RSS item 到 `raw_item`。
6. 根据 URL 或 GUID 生成 `url_hash`。
7. 使用 upsert 插入文章，冲突时忽略重复。
8. 更新 `sources.last_fetched_at`。
9. 更新 `crawl_runs` 为 success 或 failed。

本地手动触发示例：

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/cron/fetch" `
  -Headers @{ Authorization = "Bearer your-cron-secret" }
```

触发后刷新 Dashboard，`已入库文章`、`最近抓取`、`抓取日志` 会更新。

## Dashboard 展示流程

Dashboard 数据由 `src/lib/dashboard-data.ts` 聚合。

它会并行查询：

```text
sources
articles
crawl_runs
delivery_logs
```

然后在服务端把文章与来源做一次内存关联：

```text
article.source_id -> source.name / source.slug
```

页面初始只有 RSS 源，没有文章，是正常状态。只有调用过 `/api/cron/fetch` 后，`articles` 表才会有数据。

## 邮件摘要流程

邮件入口是：

```text
GET /api/cron/digest
POST /api/cron/digest
```

核心逻辑在 `src/lib/email-digest.ts`：

1. 读取默认规则 `daily-email-digest`。
2. 创建 `delivery_logs` running 记录。
3. 检查邮件配置是否完整，例如 `RESEND_API_KEY`、`EMAIL_FROM`、`DIGEST_TO_EMAIL`。
4. 根据 `lookback_hours` 查询最近入库文章。
5. 排除 `article_deliveries` 里已经发送过的文章。
6. 最多取 `max_articles` 条。
7. 构造邮件 subject、text、html。
8. 调用 `sendEmail` 发送。
9. 写入 `article_deliveries` 防止重复发送。
10. 更新 `delivery_rules.last_sent_at`。
11. 更新 `delivery_logs` 为 success、failed 或 skipped。

如果没有新文章，任务会记录为 `skipped`，这不是错误。

## 环境变量

本地使用 `.env.local`，生产环境放到 Vercel Environment Variables。

关键变量：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
DIGEST_TO_EMAIL=
NEXT_PUBLIC_APP_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` 只能在服务端使用。这个项目的抓取和邮件任务都通过 service role key 写数据库，因此不能暴露到浏览器端。

## Supabase Migration 使用方式

迁移 SQL 位于：

```text
supabase/migrations/20260524084500_create_rss_pipeline.sql
supabase/migrations/20260524092000_create_email_digest_pipeline.sql
```

应按文件名前面的时间戳顺序执行。

如果使用 Supabase 控制台：

1. 进入 Supabase Project。
2. 打开 SQL Editor。
3. 先执行 RSS pipeline SQL。
4. 再执行 email digest pipeline SQL。

注意：`create table if not exists` 不会自动补齐旧表字段。如果同一个 Supabase Project 里已经有旧版本的 `sources` 表，可能出现类似：

```text
column "feed_url" of relation "sources" does not exist
```

新项目推荐给 `ai-pulse` 单独创建一个 Supabase Project，避免和其他练习项目的表结构混用。

## 与 practice-agent 的关键区别

`practice-agent` 更像实验版，抓取逻辑更复杂：

```text
HTML 页面抓取
  -> 正则解析
  -> 插入 news_items
  -> AI 总结
  -> 更新为 processed
  -> 页面只展示 processed
```

这会带来更多失败点：

- 默认源是 HTML 页面，不是稳定 RSS。
- 页面结构变化会导致正则解析不到内容。
- 编码异常会导致关键匹配条件失效。
- AI 处理或状态更新失败后，前台可能看不到文章。
- 数据表结构与 `ai-pulse` 不同，不能混用同一个旧 Supabase 表。

`ai-pulse` 当前方案更适合作为 MVP：

- 优先 RSS，不做复杂网页抓取。
- 先保证资讯稳定入库。
- 抓取和邮件各自有日志。
- 不依赖 AI API，失败面更小。

## 本地运行方式

确保 Node 和 pnpm 版本满足项目要求：

```powershell
node --version
pnpm --version
```

启动开发服务器：

```powershell
pnpm dev
```

如果端口被占用：

```powershell
pnpm dev -- -p 3001
```

访问：

```text
http://localhost:3000
```

手动触发抓取：

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/cron/fetch" `
  -Headers @{ Authorization = "Bearer your-cron-secret" }
```

## 当前方案的优点

- 链路清晰：源配置、抓取、文章、日志、邮件推送分层明确。
- MVP 稳定：使用 RSS 而不是 HTML 正则抓取。
- 去重可靠：使用 `url_hash` 做唯一约束。
- 可观测性好：抓取和邮件都有日志表。
- 部署路径明确：Next.js + Supabase + Vercel Cron。
- 后续扩展自然：可以继续增加 AI 总结、分类、搜索、更多推送渠道。

## 可以继续优化的方向

- 增加 Dashboard 上的手动抓取按钮。
- 给 `sources` 做管理页面，支持新增、启停 RSS 源。
- 给 crawl result 增加更详细的错误展示。
- 邮件正文里的中文乱码需要检查源文件编码并修复。
- 增加文章分类、标签或 AI 摘要，但应在稳定入库之后再做。
- 增加 Supabase 类型生成，减少手写类型和表结构漂移。
- 增加端到端测试，覆盖 cron 鉴权、抓取入库、重复抓取去重。

## 一句话总结

`ai-pulse` 的实现思路是先把“稳定 RSS 数据管道”打通：用 Supabase 管数据，用 Next.js cron route 执行任务，用 Dashboard 观察状态，用邮件摘要完成交付闭环。这比一开始就做网页抓取和 AI 处理更稳，也更适合 MVP 阶段。
