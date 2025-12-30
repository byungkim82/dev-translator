# Korean-English Translation Tool - Dev Translator

## Project Overview
**Purpose**: High-quality AI translation tool for Korean developers working at US companies (Slack communication)
**Stack**: Next.js 15 + Cloudflare Workers + D1 Database
**Core Value**: Translation → Slack paste in under 10 seconds, minimal manual corrections

## Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router) with TurboPack
- **Deployment**: Cloudflare Workers via OpenNext (@opennextjs/cloudflare)
- **Database**: Cloudflare D1 (SQLite)
- **Styling**: Tailwind CSS v4
- **State Management**: TanStack Query for client-side data fetching
- **AI**: Gemini 2.5 Flash Lite for translation, OpenAI text-embedding-3-small for similarity search

### Project Structure
```
dev-translator/
├── app/
│   ├── api/
│   │   ├── translate/route.ts   # POST - Translation endpoint
│   │   ├── similar/route.ts     # POST - Similar translation search
│   │   ├── history/route.ts     # GET/PATCH/DELETE - History management
│   │   ├── settings/route.ts    # GET/PUT - Settings management
│   │   ├── export/route.ts      # GET - CSV export
│   │   └── categorize/route.ts  # POST - Auto-categorization
│   ├── history/page.tsx         # History page with search/filter
│   ├── settings/page.tsx        # Settings and stats page
│   ├── layout.tsx               # Root layout with navigation
│   ├── page.tsx                 # Main translation page
│   ├── providers.tsx            # TanStack Query provider
│   └── globals.css              # Tailwind CSS styles
├── components/
│   ├── Navigation.tsx           # Tab navigation
│   ├── TranslateForm.tsx        # Translation input form
│   ├── TranslationResult.tsx    # Translation output display
│   ├── SimilarModal.tsx         # Similar translations modal
│   ├── HistoryList.tsx          # History list with pagination
│   ├── HistoryCard.tsx          # Individual history item
│   ├── SearchFilters.tsx        # Search and filter controls
│   └── Toast.tsx                # Toast notifications
├── lib/
│   ├── ai/
│   │   ├── gemini.ts            # Gemini API wrapper
│   │   └── embedding.ts         # OpenAI embedding API
│   ├── prompts.ts               # Translation prompt templates
│   ├── similarity.ts            # Cosine similarity calculations
│   └── utils.ts                 # Utility functions
├── migrations/
│   ├── 0001_create_translations.sql
│   └── 0002_create_settings.sql
├── .github/workflows/
│   └── deploy.yml               # GitHub Actions CI/CD
├── wrangler.toml                # Cloudflare Workers config
├── open-next.config.ts          # OpenNext configuration
├── env.d.ts                     # TypeScript type definitions
└── package.json
```

## Features

### 1. Translation (Main Page)
- Korean text input with model and style selection
- Single AI model: Gemini 2.5 Flash Lite
- 4 translation styles:
  - Casual work (캐주얼 업무용) - default
  - Formal work (격식있는 업무용)
  - Very casual (매우 캐주얼)
  - Technical documentation (기술 문서용)
- One-click copy to clipboard
- Favorite toggle

### 2. Similar Translation Search
- Uses OpenAI text-embedding-3-small (1536 dimensions)
- Cosine similarity threshold: 0.85
- Shows up to 3 similar translations
- Option to reuse existing translation or create new

### 3. History (History Page)
- Full-text search (Korean/English)
- Filters: category, style, favorites
- Sorting: newest, oldest, alphabetical
- Pagination (20 items per page)
- Inline editing of favorites/categories
- Delete functionality

### 4. Settings (Settings Page)
- Default model/style configuration
- Auto-copy toggle
- Usage statistics display
- Batch auto-categorization

### 5. Data Export
- CSV export with all translation fields

### 6. Auto-categorization
- 8 categories: Code Review, Bug Report, Feature Discussion, Meeting Schedule, Question, Update/Status, Casual Chat, Other
- Batch processing via Gemini API

## Database Schema

### translations table
```sql
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  korean_text TEXT NOT NULL,
  english_text TEXT NOT NULL,
  model TEXT DEFAULT 'gemini-flash',
  style TEXT DEFAULT 'casual-work',
  category TEXT,
  embedding TEXT,  -- JSON array of 1536 floats
  is_favorite INTEGER DEFAULT 0,
  char_count INTEGER,
  token_count INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### settings table
```sql
CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  default_model TEXT DEFAULT 'gemini-flash',
  default_style TEXT DEFAULT 'casual-work',
  auto_copy INTEGER DEFAULT 0,
  updated_at TEXT
);
```

## Environment Variables

Set these as Cloudflare Workers secrets:
- `GEMINI_API_KEY` - Gemini API key for translation
- `OPENAI_API_KEY` - OpenAI API key for embeddings (optional)

## Development

### Local Development
```bash
npm install
npm run dev           # Next.js dev server
npm run dev:wrangler  # Wrangler dev server (with D1)
```

### Database Migrations
```bash
npm run db:migrate:local  # Apply migrations locally
npm run db:migrate:prod   # Apply migrations to production
```

### Build & Deploy
```bash
npm run build   # Build for production
npm run deploy  # Deploy to Cloudflare Workers
```

## CI/CD

GitHub Actions workflow (.github/workflows/deploy.yml):
- Triggers on push to main branch
- Runs migrations
- Builds and deploys to Cloudflare Workers
- Requires GitHub secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID

## Authentication

Uses Cloudflare Access for authentication:
- Email whitelist configuration via Cloudflare Dashboard
- No application-level auth code needed

## Performance Targets

- Translation response: < 3 seconds
- Similar search: < 200ms (1000 items)
- UI responsiveness: < 50ms
- History loading: < 500ms (lazy loading)

## Legacy

The original single HTML file implementation is preserved in the `legacy/` folder for reference.
