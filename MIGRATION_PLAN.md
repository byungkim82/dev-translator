# Next.js + Cloudflare Workers 마이그레이션 계획

> **참고**: prompt-parrot 프로젝트 구조를 기반으로 설계

## 1. 프로젝트 개요

### 현재 상태
- 단일 HTML 파일 (~500KB)
- IndexedDB (Dexie.js) 로컬 저장소
- 클라이언트에서 직접 AI API 호출
- 로컬 브라우저에서만 사용 가능

### 목표 상태
- Next.js 15 + OpenNext → Cloudflare Workers 단일 배포
- Cloudflare D1 데이터베이스
- 서버사이드 AI API 호출 (API 키 보호)
- Cloudflare Access 인증 (선택)
- 어디서나 접속 가능한 웹 애플리케이션
- GitHub Actions CI/CD

---

## 2. 기술 스택

### 프레임워크
- **Next.js 15** (App Router)
- **OpenNext** (@opennextjs/cloudflare) - Next.js → Cloudflare Workers 어댑터

### 프론트엔드
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **UI Components**: React 19

### 백엔드 (Next.js API Routes)
- **Runtime**: Cloudflare Workers (via OpenNext)
- **Database**: Cloudflare D1 (SQLite)
- **AI API**: Gemini 2.5 Flash Lite (번역 + 카테고리 분류)
- **Embedding**: OpenAI text-embedding-3-small

### 인프라
- **Hosting**: Cloudflare Workers (단일 배포)
- **Static Assets**: Cloudflare Workers Assets
- **Authentication**: Cloudflare Access (Zero Trust) - 선택사항
- **CI/CD**: GitHub Actions
- **Secrets**: GitHub Secrets → Wrangler CLI

---

## 3. 프로젝트 구조

```
dev-translator/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions 배포
│
├── app/                            # Next.js App Router
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # 메인 번역 페이지
│   ├── history/
│   │   └── page.tsx                # 히스토리 페이지
│   ├── settings/
│   │   └── page.tsx                # 설정 페이지
│   ├── api/
│   │   ├── translate/
│   │   │   └── route.ts            # POST /api/translate
│   │   ├── similar/
│   │   │   └── route.ts            # POST /api/similar
│   │   ├── history/
│   │   │   └── route.ts            # GET, POST, DELETE /api/history
│   │   ├── export/
│   │   │   └── route.ts            # GET /api/export?format=csv
│   │   ├── categorize/
│   │   │   └── route.ts            # POST /api/categorize
│   │   └── settings/
│   │       └── route.ts            # GET, PUT /api/settings
│   ├── hooks/
│   │   ├── useTranslate.ts
│   │   ├── useHistory.ts
│   │   └── useSettings.ts
│   └── providers.tsx               # TanStack Query Provider
│
├── components/
│   ├── TranslateForm.tsx
│   ├── TranslationResult.tsx
│   ├── HistoryList.tsx
│   ├── HistoryCard.tsx
│   ├── SearchFilters.tsx
│   ├── SimilarModal.tsx
│   ├── Navigation.tsx
│   └── Toast.tsx
│
├── lib/
│   ├── ai/
│   │   ├── gemini.ts               # Gemini 2.5 Flash Lite API 호출
│   │   └── embedding.ts            # OpenAI 임베딩 생성
│   ├── prompts.ts                  # 번역 프롬프트 템플릿
│   ├── similarity.ts               # 코사인 유사도 계산
│   └── utils.ts                    # 유틸리티 함수
│
├── migrations/
│   ├── 0001_create_translations.sql
│   └── 0002_create_settings.sql
│
├── public/
│   └── favicon.ico
│
├── .dev.vars                       # 로컬 개발용 시크릿 (gitignore)
├── env.d.ts                        # Cloudflare 타입 정의
├── next.config.ts
├── open-next.config.ts             # OpenNext 설정
├── tailwind.config.ts
├── tsconfig.json
├── wrangler.toml                   # Cloudflare Workers 설정
└── package.json
```

---

## 4. 데이터베이스 스키마 (Cloudflare D1)

### translations 테이블
```sql
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,              -- Cloudflare Access 사용자 ID
  korean_text TEXT NOT NULL,
  english_text TEXT NOT NULL,
  model TEXT NOT NULL,                -- 'gemini-flash' | 'claude-haiku' | 'gpt-4o-mini'
  style TEXT NOT NULL,                -- 'casual-work' | 'formal-work' | 'very-casual' | 'technical-doc'
  category TEXT,                      -- 자동 분류된 카테고리
  embedding BLOB,                     -- 1536-dim vector (JSON 직렬화)
  is_favorite INTEGER DEFAULT 0,
  char_count INTEGER,
  token_count INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_user_timestamp ON translations(user_id, created_at DESC);
CREATE INDEX idx_user_category ON translations(user_id, category);
CREATE INDEX idx_user_favorite ON translations(user_id, is_favorite);
```

### settings 테이블
```sql
CREATE TABLE settings (
  user_id TEXT PRIMARY KEY,
  default_model TEXT DEFAULT 'gemini-flash',
  default_style TEXT DEFAULT 'casual-work',
  auto_copy INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 5. API 엔드포인트 설계

### Next.js API Routes

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/translate` | 번역 요청 + 저장 |
| POST | `/api/similar` | 유사 번역 검색 (임베딩 기반) |
| GET | `/api/history` | 번역 목록 (pagination, filter, search) |
| POST | `/api/history` | 번역 저장 (수동) |
| PATCH | `/api/history` | 번역 수정 (즐겨찾기, 수정 등) |
| DELETE | `/api/history` | 번역 삭제 |
| GET | `/api/export` | CSV 내보내기 |
| POST | `/api/categorize` | 미분류 항목 일괄 분류 |
| GET | `/api/settings` | 사용자 설정 조회 |
| PUT | `/api/settings` | 사용자 설정 저장 |

---

## 6. 인증 (Cloudflare Access) - 선택사항

### 옵션 A: Cloudflare Access (권장)
- Cloudflare Zero Trust 대시보드에서 Access 애플리케이션 생성
- 도메인: `translator.your-domain.com`
- 인증 방식: 이메일 화이트리스트 또는 GitHub OAuth
- 장점: 별도 인증 코드 불필요, Cloudflare 레벨에서 차단

### 옵션 B: 인증 없이 배포
- 개인용이라면 Workers URL만 공개하지 않으면 됨
- 단, URL이 노출되면 누구나 접근 가능

### 사용자 식별 (멀티유저 지원 시)
```typescript
// Cloudflare Access JWT에서 사용자 정보 추출
const email = request.headers.get('cf-access-authenticated-user-email');
// 또는 JWT 파싱으로 sub (사용자 ID) 추출
```

---

## 7. 시크릿 관리

### GitHub Repository Secrets
```
CLOUDFLARE_API_TOKEN      # Cloudflare API 토큰
CLOUDFLARE_ACCOUNT_ID     # Cloudflare 계정 ID
GEMINI_API_KEY            # Gemini 2.5 Flash Lite API 키
OPENAI_API_KEY            # OpenAI API 키 (임베딩용)
```

### 로컬 개발 (.dev.vars)
```bash
# .dev.vars (gitignore에 추가)
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
```

---

## 8. 구현 단계 (Phases)

### Phase 1: 프로젝트 초기 설정
- [ ] Next.js 15 프로젝트 초기화 (App Router)
- [ ] OpenNext 설정 (@opennextjs/cloudflare)
- [ ] Tailwind CSS 설정
- [ ] wrangler.toml 설정
- [ ] D1 데이터베이스 생성
- [ ] 마이그레이션 파일 작성 및 실행
- [ ] env.d.ts 타입 정의

### Phase 2: 핵심 번역 기능
- [ ] Gemini 2.5 Flash Lite API 연동
- [ ] 번역 프롬프트 템플릿 (4가지 스타일)
- [ ] /api/translate API Route
- [ ] TranslateForm 컴포넌트
- [ ] TranslationResult 컴포넌트
- [ ] 복사 기능
- [ ] Toast 알림 시스템

### Phase 3: 히스토리 & 검색
- [ ] /api/history API Route (CRUD)
- [ ] TanStack Query 설정
- [ ] HistoryList 컴포넌트 (무한 스크롤)
- [ ] HistoryCard 컴포넌트
- [ ] SearchFilters 컴포넌트
- [ ] 즐겨찾기 토글

### Phase 4: 유사 번역 검색
- [ ] OpenAI Embedding API 연동
- [ ] /api/similar API Route
- [ ] 코사인 유사도 계산
- [ ] SimilarModal 컴포넌트

### Phase 5: 데이터 관리 & 설정
- [ ] /api/export API Route (CSV)
- [ ] /api/categorize API Route (자동 분류)
- [ ] /api/settings API Route
- [ ] 설정 페이지 UI

### Phase 6: CI/CD & 배포
- [ ] GitHub Actions 워크플로우
- [ ] D1 마이그레이션 자동화
- [ ] 시크릿 동기화
- [ ] Cloudflare Access 설정 (선택)

---

## 9. GitHub Actions 워크플로우

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build with OpenNext
        run: npm run build
        env:
          NODE_ENV: production

      - name: Run D1 migrations
        run: npx wrangler d1 migrations apply translator-db --remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Sync secrets
        run: |
          echo "${{ secrets.GEMINI_API_KEY }}" | npx wrangler secret put GEMINI_API_KEY
          echo "${{ secrets.OPENAI_API_KEY }}" | npx wrangler secret put OPENAI_API_KEY
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy to Cloudflare Workers
        run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

## 10. 주요 변경사항 요약

| 항목 | 기존 | 변경 후 |
|------|------|---------|
| 아키텍처 | 단일 HTML 파일 | Next.js 15 + OpenNext |
| 백엔드 | 없음 (클라이언트 직접 호출) | Next.js API Routes on Workers |
| 데이터베이스 | IndexedDB (로컬) | Cloudflare D1 (서버) |
| 인증 | 없음 | Cloudflare Access (선택) |
| AI 기본 모델 | Gemini Flash | **Gemini 2.5 Flash Lite** |
| API 키 관리 | 로컬 암호화 저장 | 서버 환경변수 |
| 배포 | 수동 (파일 공유) | GitHub Actions 자동화 |
| 접근성 | 로컬 브라우저만 | 어디서나 (URL 접속) |

---

## 11. 고려사항

### Cloudflare Workers 제약
- **Node.js API 제한**: Edge 호환 API만 사용 가능
- **ISR 미지원**: Incremental Static Regeneration 불가
- **D1 접근**: 로컬 개발 시 `wrangler dev` 필요

### 성능
- D1: 읽기 최적화, 쓰기는 약간 느림
- 임베딩 검색: 1000개+ 시 성능 저하 → 필요시 Vectorize 고려

### 비용 (Free Tier 충분)
- Workers: 일 100,000 요청
- D1: 일 5GB 읽기, 100,000 쓰기
- AI API: 기존과 동일

---

## 12. 확정된 설정

| 항목 | 결정 |
|------|------|
| Cloudflare 계정 | 있음 |
| GitHub 리포 | byungkim82/dev-translator |
| 인증 방식 | Cloudflare Access (이메일 화이트리스트) |
| AI 모델 | **Gemini 2.5 Flash Lite** |
| 유사 번역 검색 | 포함 (임베딩 기반) |
| 자동 카테고리 분류 | 포함 |
| Export | CSV만 (PDF 제외) |
| 도메인 | Workers 기본 URL 사용 |

---

## 13. 구현 시작

계획 확정됨. Phase 1부터 순차 구현 진행:
1. Phase 1: 프로젝트 초기 설정
2. Phase 2: 핵심 번역 기능
3. Phase 3: 히스토리 & 검색
4. Phase 4: 유사 번역 검색
5. Phase 5: 데이터 관리 & 설정
6. Phase 6: CI/CD & 배포
