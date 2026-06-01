# 全球产业雷达与一级投资信号系统

一个日频 MVP：用免费公开数据和可解释 RAG/harness，把二级市场异动转成一级投资观察卡。

第一版默认不做交易建议，也不保存全球全量原始行情。它只持久化主题本体、证据摘要、信号卡、反馈和评估结果，适合放在 Vercel + Neon/Supabase 上小规模运行。

## 功能

- 产业主题雷达：AI 算力/内存/HBM、光伏、储能、电网、铜/电气化、机器人、核电、GLP-1 等。
- API：
  - `GET /api/radar?date=YYYY-MM-DD`
  - `GET /api/signals/:id`
  - `POST /api/feedback`
  - `GET /api/cron/daily-radar`
- 前端看板：主题排名、动量窗口、证据覆盖、一级可投角度、反证指标和反馈按钮。
- Python ETL：Stooq 日线抓取、行情质量检查、主题信号生成、Supabase upsert。
- Harness：检查 schema、证据数量、证据绑定和历史有效性占位。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

没有数据库环境变量时，应用会进入 deterministic demo mode；API、看板和反馈流仍然可用，便于先验证产品逻辑。

## 数据/评估命令

```bash
python3 scripts/etl.py --date 2026-06-01 --dry-run --out work/radar-2026-06-01.json
python3 scripts/harness.py work/radar-2026-06-01.json
npm run check
```

## Database

Vercel 上最快的方式是接 Neon Marketplace，它会自动注入 `POSTGRES_URL`。本地或 CI 可执行：

```bash
npm run db:migrate
```

如果使用 Supabase：

1. 创建 Supabase 项目。
2. 在 SQL editor 执行 `supabase/migrations/001_initial_schema.sql`。
3. 在 Vercel/Shell 配置：

```bash
POSTGRES_URL=...
CRON_SECRET=...
```

或：

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
```

服务端只使用数据库密钥；不要把它暴露给浏览器。看板公开接口读取的是已筛选的信号卡 JSON。

## Vercel

`vercel.json` 中配置了每天 `22:30 UTC` 的 cron，相当于北京时间早上 `06:30` 左右。Cron route 会校验：

```http
Authorization: Bearer $CRON_SECRET
```

Vercel Hobby 适合日频 MVP；如果后面要小时级刷新、更多 cron 或长任务，应迁到 GitHub Actions/队列/独立 worker。

## 免费源边界

- Stooq/Alpha Vantage/FRED/EIA/World Bank/GDELT/SEC/USPTO/arXiv 均适合 MVP 级公开数据接入，但需要遵守各自条款、频率限制和 attribution。
- “全球全量”在本项目中定义为“全球产业代理全覆盖”，不是每个上市公司全历史 tick/日线。
- LLM 分析默认只处理每日 Top 10-20 个主题，先积累人工反馈，再决定是否后训练。
