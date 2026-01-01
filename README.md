# 🌐 Dev Translator - Korean-English Translation Tool

한국인 개발자가 미국 회사 Slack에서 사용할 수 있는 고품질 AI 번역 도구입니다.

**번역 → Slack 붙여넣기 10초 이내, 최소한의 수동 수정**

## ✨ 주요 기능

- **AI 번역**: Gemini 2.5 Flash Lite를 활용한 고품질 번역
- **4가지 번역 스타일**: 캐주얼 업무용(기본), 격식있는 업무용, 매우 캐주얼, 기술 문서용
- **스마트 유사 번역 추천**: OpenAI Embedding 기반 유사 번역 자동 검색 (코사인 유사도 > 0.85)
- **강력한 히스토리 관리**: 전체 텍스트 검색, 필터링, 정렬, 즐겨찾기
- **데이터 관리**: CSV Export, 사용 통계, 자동 카테고리 분류
- **원클릭 복사**: 번역 결과 클립보드 복사

## 🛠️ 기술 스택

### Frontend
- **Framework**: Next.js 15 (App Router) with TurboPack
- **React**: 19.1.0
- **Styling**: Tailwind CSS v4
- **State Management**: TanStack Query v5

### Backend
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: OpenNext (@opennextjs/cloudflare)

### AI
- **Translation**: Google Gemini 2.5 Flash Lite
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Similarity Search**: Cosine similarity > 0.85

## 🚀 빠른 시작

### 사전 요구사항

- Node.js 18+
- npm 또는 yarn
- Cloudflare 계정 (배포 시)

### 1. 프로젝트 클론 및 설치

```bash
git clone https://github.com/byungkim82/dev-translator.git
cd dev-translator
npm install
```

### 2. 환경 변수 설정

로컬 개발을 위해 `.dev.vars` 파일을 생성합니다:

```bash
# .dev.vars
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here  # 선택사항 (유사 번역 검색용)
```

**API 키 발급:**
- **Gemini API**: https://aistudio.google.com/app/apikey
- **OpenAI API**: https://platform.openai.com/api-keys

### 3. 데이터베이스 마이그레이션

로컬 개발 환경에서 D1 데이터베이스를 초기화합니다:

```bash
npm run db:migrate:local
```

### 4. 로컬 개발 서버 실행

**Next.js 개발 서버** (핫 리로드):
```bash
npm run dev
```

**Wrangler 개발 서버** (D1 데이터베이스 포함):
```bash
npm run dev:wrangler
```

브라우저에서 http://localhost:3000 을 엽니다.

### 5. 번역 시작!

1. 한국어 텍스트 입력
2. 번역 스타일 선택 (기본: 캐주얼 업무용)
3. **번역하기** 버튼 클릭
4. 결과를 복사하여 Slack에 붙여넣기

## 📁 프로젝트 구조

```
dev-translator/
├── app/
│   ├── api/
│   │   ├── translate/route.ts   # POST - 번역 API
│   │   ├── similar/route.ts     # POST - 유사 번역 검색
│   │   ├── history/route.ts     # GET/PATCH/DELETE - 히스토리 관리
│   │   ├── settings/route.ts    # GET/PUT - 설정 관리
│   │   ├── export/route.ts      # GET - CSV 내보내기
│   │   └── categorize/route.ts  # POST - 자동 카테고리 분류
│   ├── history/page.tsx         # 히스토리 페이지
│   ├── settings/page.tsx        # 설정 및 통계 페이지
│   ├── layout.tsx               # 루트 레이아웃 (내비게이션)
│   ├── page.tsx                 # 메인 번역 페이지
│   ├── providers.tsx            # TanStack Query Provider
│   └── globals.css              # Tailwind CSS 스타일
├── components/
│   ├── Navigation.tsx           # 탭 내비게이션
│   ├── TranslateForm.tsx        # 번역 입력 폼
│   ├── TranslationResult.tsx    # 번역 결과 표시
│   ├── SimilarModal.tsx         # 유사 번역 모달
│   ├── HistoryList.tsx          # 히스토리 목록 (페이지네이션)
│   ├── HistoryCard.tsx          # 히스토리 아이템
│   ├── SearchFilters.tsx        # 검색 및 필터 컨트롤
│   └── Toast.tsx                # 토스트 알림
├── lib/
│   ├── ai/
│   │   ├── gemini.ts            # Gemini API Wrapper
│   │   └── embedding.ts         # OpenAI Embedding API
│   ├── prompts.ts               # 번역 프롬프트 템플릿
│   ├── similarity.ts            # 코사인 유사도 계산
│   └── utils.ts                 # 유틸리티 함수
├── migrations/
│   ├── 0001_create_translations.sql
│   └── 0002_create_settings.sql
├── .github/workflows/
│   └── deploy.yml               # GitHub Actions CI/CD
├── legacy/                      # 레거시 단일 HTML 파일 (참고용)
├── wrangler.toml                # Cloudflare Workers 설정
├── open-next.config.ts          # OpenNext 설정
└── package.json
```

## 💾 데이터베이스 스키마

### translations 테이블
```sql
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  korean_text TEXT NOT NULL,
  english_text TEXT NOT NULL,
  model TEXT DEFAULT 'gemini-flash',
  style TEXT DEFAULT 'casual-work',
  category TEXT,
  embedding TEXT,              -- JSON array (1536 floats)
  is_favorite INTEGER DEFAULT 0,
  char_count INTEGER,
  token_count INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### settings 테이블
```sql
CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  default_model TEXT DEFAULT 'gemini-flash',
  default_style TEXT DEFAULT 'casual-work',
  auto_copy INTEGER DEFAULT 0,
  updated_at TEXT
);
```

## 📖 사용 예시

### 캐주얼 업무용 (기본)
```
입력: 이 버그 확인 부탁드립니다
출력: Hey, could you check this bug?
```

### 격식있는 업무용
```
입력: 이 버그 확인 부탁드립니다
출력: I would appreciate if you could review this bug.
```

### 기술 문서용
```
입력: 이 함수는 사용자 인증을 처리합니다
출력: This function handles user authentication.
```

## 🚢 배포 (Cloudflare Workers)

### 1. Cloudflare 계정 설정

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)에서 계정 생성
2. Workers & Pages 섹션에서 D1 데이터베이스 생성

### 2. 환경 변수 설정

Cloudflare Workers 시크릿 설정:

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put OPENAI_API_KEY
```

### 3. 데이터베이스 마이그레이션 (프로덕션)

```bash
npm run db:migrate:prod
```

### 4. 배포

```bash
npm run build
npm run deploy
```

### 5. GitHub Actions CI/CD

`.github/workflows/deploy.yml` 파일이 설정되어 있어 `main` 브랜치에 푸시하면 자동으로 배포됩니다.

**필요한 GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 6. 인증 (Cloudflare Access)

Cloudflare Access를 사용하여 이메일 화이트리스트 기반 인증을 설정할 수 있습니다.

## 🔧 개발

### npm 스크립트

```bash
npm run dev              # Next.js 개발 서버
npm run dev:wrangler     # Wrangler 개발 서버 (D1 포함)
npm run build            # 프로덕션 빌드
npm run deploy           # Cloudflare Workers 배포
npm run db:migrate:local # 로컬 DB 마이그레이션
npm run db:migrate:prod  # 프로덕션 DB 마이그레이션
```

### 로컬 개발 워크플로우

1. 코드 변경
2. `npm run dev:wrangler` 실행
3. 브라우저에서 테스트
4. git commit & push
5. GitHub Actions가 자동으로 배포

## 🎯 성능 목표

| 메트릭 | 목표 | 상태 |
|--------|------|------|
| 번역 응답 시간 | < 3초 | ✅ |
| 유사 번역 검색 | < 200ms (1000개 기준) | ✅ |
| UI 반응성 | < 50ms | ✅ |
| 히스토리 로딩 | < 500ms (lazy loading) | ✅ |

## 💰 비용 추정

월 200번 사용 기준:
- **Gemini 2.5 Flash Lite** (200번): ~$0.01
- **OpenAI Embedding** (200번): ~$0.003
- **Cloudflare Workers**: Free tier (100,000 requests/day)
- **Cloudflare D1**: Free tier (5GB storage)
- **총계**: ~$0.013/월

## 🔒 보안 & 프라이버시

- ✅ API 키는 Cloudflare Workers Secrets으로 안전하게 관리
- ✅ 모든 번역 데이터는 D1 데이터베이스에 저장
- ✅ Cloudflare Access를 통한 인증 (이메일 화이트리스트)
- ✅ HTTPS 암호화 통신
- ✅ XSS 방지 (React 자동 이스케이프)

## 📦 레거시

단일 HTML 파일 버전은 `legacy/` 폴더에 보관되어 있습니다. 현재 프로젝트는 Next.js + Cloudflare Workers 아키텍처로 마이그레이션되었습니다.

## 🤝 기여 방법

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

MIT License - 자유롭게 사용하세요!

## 🐛 버그 리포트 & 기능 요청

[Issues](https://github.com/byungkim82/dev-translator/issues) 탭에서 버그 리포트나 기능 요청을 남겨주세요.

## 📮 연락처

프로젝트 Link: [https://github.com/byungkim82/dev-translator](https://github.com/byungkim82/dev-translator)

## 🙏 감사의 말

- **Claude AI**: 코드 생성 및 개발 지원
- **Google Gemini**: 고품질 번역 제공
- **OpenAI**: Embedding API
- **Cloudflare**: Workers 및 D1 Database 플랫폼
- **Vercel**: Next.js 프레임워크

---

**Made with ❤️ for Korean developers working in US companies**
