# Next.js + Cloudflare Workers 마이그레이션 계획

## 1. 프로젝트 개요

### 현재 상태
- 단일 HTML 파일 (~500KB)
- IndexedDB (Dexie.js) 로컬 저장소
- 클라이언트에서 직접 AI API 호출
- 로컬 브라우저에서만 사용 가능

### 목표 상태
- Next.js 프론트엔드 + Cloudflare Workers 백엔드
- Cloudflare D1 데이터베이스
- 서버사이드 AI API 호출 (API 키 보호)
- Cloudflare Access 인증
- 어디서나 접속 가능한 웹 애플리케이션
- GitHub Actions CI/CD

---

## 2. 기술 스택

### 프론트엔드
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **State Management**: React Context + SWR (API 캐싱)
- **Build**: Static Export → Cloudflare Pages

### 백엔드
- **Runtime**: Cloudflare Workers (Hono.js 프레임워크)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **AI APIs**: Gemini 2.0 Flash (기본), Claude Haiku, GPT-4o-mini

### 인프라
- **Hosting**: Cloudflare Pages (프론트엔드) + Cloudflare Workers (API)
- **Authentication**: Cloudflare Access (Zero Trust)
- **CI/CD**: GitHub Actions
- **Secrets**: GitHub Repository Secrets → Cloudflare Environment Variables

---

## 3. 프로젝트 구조

```
dev-translator/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions 배포 워크플로우
├── apps/
│   ├── web/                        # Next.js 프론트엔드
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx        # 메인 번역 페이지
│   │   │   │   ├── history/
│   │   │   │   │   └── page.tsx    # 히스토리 페이지
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx    # 설정 페이지
│   │   │   ├── components/
│   │   │   │   ├── TranslateForm.tsx
│   │   │   │   ├── TranslationResult.tsx
│   │   │   │   ├── HistoryList.tsx
│   │   │   │   ├── HistoryCard.tsx
│   │   │   │   ├── SearchFilters.tsx
│   │   │   │   ├── SimilarModal.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   └── Navigation.tsx
│   │   │   ├── lib/
│   │   │   │   ├── api.ts          # API 클라이언트
│   │   │   │   └── utils.ts        # 유틸리티 함수
│   │   │   └── styles/
│   │   │       └── globals.css
│   │   ├── tailwind.config.ts
│   │   ├── next.config.js
│   │   └── package.json
│   │
│   └── api/                        # Cloudflare Workers API
│       ├── src/
│       │   ├── index.ts            # Hono 앱 엔트리
│       │   ├── routes/
│       │   │   ├── translate.ts    # 번역 API
│       │   │   ├── history.ts      # 히스토리 CRUD
│       │   │   ├── similar.ts      # 유사 번역 검색
│       │   │   ├── export.ts       # Export API
│       │   │   └── settings.ts     # 설정 API
│       │   ├── services/
│       │   │   ├── gemini.ts       # Gemini API 서비스
│       │   │   ├── claude.ts       # Claude API 서비스
│       │   │   ├── openai.ts       # OpenAI API 서비스
│       │   │   └── embedding.ts    # 임베딩 서비스
│       │   ├── db/
│       │   │   ├── schema.ts       # Drizzle 스키마
│       │   │   └── migrations/     # D1 마이그레이션
│       │   └── lib/
│       │       ├── prompts.ts      # 번역 프롬프트 템플릿
│       │       └── similarity.ts   # 코사인 유사도 계산
│       ├── wrangler.toml           # Cloudflare 설정
│       └── package.json
│
├── packages/
│   └── shared/                     # 공유 타입/유틸리티
│       ├── src/
│       │   └── types.ts
│       └── package.json
│
├── turbo.json                      # Turborepo 설정 (모노레포)
├── package.json
└── README.md
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

### 번역 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/translate` | 새 번역 요청 |
| GET | `/api/translate/similar` | 유사 번역 검색 |

### 히스토리 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/history` | 번역 목록 조회 (페이지네이션, 필터, 검색) |
| GET | `/api/history/:id` | 단일 번역 조회 |
| PATCH | `/api/history/:id` | 번역 수정 (즐겨찾기 토글 등) |
| DELETE | `/api/history/:id` | 번역 삭제 |
| POST | `/api/history/categorize` | 미분류 항목 일괄 분류 |

### Export API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/export/json` | JSON 형식 내보내기 |
| GET | `/api/export/csv` | CSV 형식 내보내기 |

### 설정 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/settings` | 사용자 설정 조회 |
| PUT | `/api/settings` | 사용자 설정 저장 |
| GET | `/api/settings/stats` | 사용 통계 조회 |

---

## 6. 인증 (Cloudflare Access)

### 설정 방식
1. Cloudflare Zero Trust 대시보드에서 Access 애플리케이션 생성
2. 도메인 설정: `translator.your-domain.com`
3. 인증 방식: 이메일 화이트리스트 또는 GitHub OAuth
4. Workers에서 `cf-access-jwt-assertion` 헤더 검증

### 사용자 식별
```typescript
// Cloudflare Access JWT에서 사용자 정보 추출
interface AccessJWT {
  email: string;
  sub: string;  // 사용자 고유 ID
  iat: number;
  exp: number;
}

// 모든 API에서 user_id로 sub 사용
const userId = jwt.sub;
```

---

## 7. 시크릿 관리

### GitHub Repository Secrets
```
CLOUDFLARE_API_TOKEN      # Cloudflare API 토큰
CLOUDFLARE_ACCOUNT_ID     # Cloudflare 계정 ID
GEMINI_API_KEY            # Gemini API 키
CLAUDE_API_KEY            # Claude API 키
OPENAI_API_KEY            # OpenAI API 키
```

### GitHub Actions → Cloudflare Workers
```yaml
# .github/workflows/deploy.yml
- name: Deploy API
  run: |
    wrangler secret put GEMINI_API_KEY --env production <<< "${{ secrets.GEMINI_API_KEY }}"
    wrangler secret put CLAUDE_API_KEY --env production <<< "${{ secrets.CLAUDE_API_KEY }}"
    wrangler secret put OPENAI_API_KEY --env production <<< "${{ secrets.OPENAI_API_KEY }}"
```

---

## 8. 구현 단계 (Phases)

### Phase 1: 프로젝트 초기 설정 (1-2일)
- [ ] 모노레포 구조 생성 (Turborepo)
- [ ] Next.js 앱 초기화
- [ ] Cloudflare Workers 프로젝트 초기화
- [ ] Tailwind CSS 설정
- [ ] 공유 타입 패키지 설정
- [ ] wrangler.toml 설정

### Phase 2: 데이터베이스 & API 기반 (2-3일)
- [ ] D1 데이터베이스 생성
- [ ] Drizzle ORM 스키마 정의
- [ ] 마이그레이션 실행
- [ ] Hono.js API 기본 구조
- [ ] Cloudflare Access 인증 미들웨어
- [ ] CORS 설정

### Phase 3: 핵심 번역 API (2-3일)
- [ ] Gemini 2.0 Flash API 연동 (기본 모델)
- [ ] Claude Haiku API 연동
- [ ] GPT-4o-mini API 연동
- [ ] 번역 프롬프트 템플릿 (4가지 스타일)
- [ ] 번역 저장 API
- [ ] OpenAI 임베딩 생성

### Phase 4: 프론트엔드 - 번역 탭 (2-3일)
- [ ] Navigation 컴포넌트
- [ ] TranslateForm 컴포넌트
- [ ] 모델/스타일 선택 UI
- [ ] TranslationResult 컴포넌트
- [ ] 복사 기능
- [ ] Toast 알림 시스템
- [ ] API 연동 (SWR)

### Phase 5: 유사 번역 검색 (1-2일)
- [ ] 임베딩 기반 유사도 검색 API
- [ ] SimilarModal 컴포넌트
- [ ] 유사 번역 선택/새 번역 분기

### Phase 6: 히스토리 & 검색 (2-3일)
- [ ] 히스토리 목록 API (페이지네이션)
- [ ] 검색 API (한국어/영어 전문 검색)
- [ ] 필터 API (카테고리, 모델, 즐겨찾기)
- [ ] HistoryList 컴포넌트
- [ ] HistoryCard 컴포넌트
- [ ] SearchFilters 컴포넌트
- [ ] 무한 스크롤

### Phase 7: 데이터 관리 (1-2일)
- [ ] JSON Export API
- [ ] CSV Export API
- [ ] 자동 카테고리 분류 API
- [ ] 설정 CRUD API
- [ ] 통계 API
- [ ] 설정 페이지 UI

### Phase 8: CI/CD & 배포 (1-2일)
- [ ] GitHub Actions 워크플로우 작성
- [ ] D1 마이그레이션 자동화
- [ ] 시크릿 배포 자동화
- [ ] Cloudflare Pages 배포 설정
- [ ] Cloudflare Workers 배포 설정
- [ ] Cloudflare Access 설정

### Phase 9: 테스트 & 최적화 (1-2일)
- [ ] E2E 테스트
- [ ] 성능 최적화
- [ ] 에러 핸들링 검토
- [ ] 문서화

---

## 9. GitHub Actions 워크플로우

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run D1 migrations
        working-directory: apps/api
        run: npx wrangler d1 migrations apply translator-db --remote

      - name: Deploy Workers
        working-directory: apps/api
        run: |
          npx wrangler secret put GEMINI_API_KEY <<< "${{ secrets.GEMINI_API_KEY }}"
          npx wrangler secret put CLAUDE_API_KEY <<< "${{ secrets.CLAUDE_API_KEY }}"
          npx wrangler secret put OPENAI_API_KEY <<< "${{ secrets.OPENAI_API_KEY }}"
          npx wrangler deploy

  deploy-web:
    runs-on: ubuntu-latest
    needs: deploy-api
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        working-directory: apps/web
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: https://api.translator.your-domain.com

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: translator-web
          directory: apps/web/out
```

---

## 10. 주요 변경사항 요약

| 항목 | 기존 | 변경 후 |
|------|------|---------|
| 프론트엔드 | 단일 HTML | Next.js (React) |
| 백엔드 | 없음 (클라이언트 직접 호출) | Cloudflare Workers |
| 데이터베이스 | IndexedDB (로컬) | Cloudflare D1 (서버) |
| 인증 | 없음 | Cloudflare Access |
| AI 기본 모델 | Gemini Flash | Gemini 2.0 Flash |
| API 키 관리 | 로컬 암호화 저장 | 서버 환경변수 |
| 배포 | 수동 (파일 공유) | GitHub Actions 자동화 |
| 접근성 | 로컬 브라우저만 | 어디서나 (인증 후) |

---

## 11. 예상 고려사항

### 성능
- D1은 읽기에 최적화, 쓰기는 약간 느릴 수 있음
- 임베딩 검색은 1000개 이상 시 성능 저하 가능 → 배치 처리 또는 벡터 DB 고려

### 비용
- Cloudflare Workers: Free tier 충분 (일 100,000 요청)
- D1: Free tier 충분 (일 5GB 읽기, 100,000 쓰기)
- AI API: 기존과 동일

### 보안
- API 키가 서버에만 존재하여 클라이언트 노출 방지
- Cloudflare Access로 인증된 사용자만 접근

---

## 12. 다음 단계

이 계획에 대한 검토가 완료되면:
1. Phase 1부터 순차적으로 구현 시작
2. 각 Phase 완료 후 커밋 및 푸시
3. 전체 완료 후 PR 생성

**질문이나 수정이 필요한 부분이 있으면 말씀해 주세요!**
