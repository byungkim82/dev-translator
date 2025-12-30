# PRD: Korean-English Translation Tool for Slack Communication

## 1. Executive Summary

### Problem Statement
한국인 개발자가 미국 회사에서 영어 네이티브 스피커들과 Slack으로 의사소통할 때:
- 번역기 사용 후 어색한 표현을 수동으로 수정하는 과정이 번거로움
- 자연스러운 영어 표현인지 매번 확인이 필요함
- 번역기 → 수정 → 복사 → 붙여넣기의 반복적인 워크플로우

### Solution
Next.js + Cloudflare Workers 기반의 AI 번역 웹앱으로:
- 고품질 AI 모델을 활용한 자연스러운 영어 번역
- 클라우드 기반 데이터 저장 (D1 Database)
- 유사 번역 추천으로 일관성 유지
- 원클릭 워크플로우
- Cloudflare Access를 통한 인증

### Success Metrics
- 번역 → 슬랙 입력까지 10초 이내
- 사용자가 수동 수정 없이 번역 결과를 80% 이상 그대로 사용
- 월 200+ 번역 저장 및 재사용

---

## 2. Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Deployment**: Cloudflare Workers via OpenNext
- **Database**: Cloudflare D1 (SQLite)
- **Styling**: Tailwind CSS v4
- **State Management**: TanStack Query
- **AI**: Gemini 2.5 Flash Lite (translation), OpenAI text-embedding-3-small (embeddings)
- **Authentication**: Cloudflare Access (email whitelist)
- **CI/CD**: GitHub Actions

### Infrastructure
```
User → Cloudflare Access → Cloudflare Workers → D1 Database
                                  ↓
                          Gemini API / OpenAI API
```

---

## 3. Core Features

### 3.1 AI Translation Engine

**Model**: Gemini 2.5 Flash Lite (fast and cost-effective)

**Translation Styles**:
1. **캐주얼 업무용** (디폴트) - "Hey, could you check this?"
2. **격식있는 업무용** - "I would appreciate if you could review this."
3. **매우 캐주얼** - "Can you take a look at this real quick?"
4. **기술 문서용** - "This implementation utilizes..."

### 3.2 Similar Translation Search

**Process**:
1. 사용자가 한국어 입력 후 "번역" 버튼 클릭
2. 입력 텍스트의 임베딩 벡터 생성 (OpenAI text-embedding-3-small)
3. D1에서 코사인 유사도 계산
4. 유사도 > 0.85인 과거 번역이 있으면:
   - 모달 팝업으로 최대 3개 유사 번역 표시
   - "이 번역 사용" 또는 "새로 번역" 선택

### 3.3 Translation History

**Features**:
- 한국어/영어 전문 검색
- 필터: 카테고리, 스타일, 즐겨찾기
- 정렬: 최신순, 오래된순, 가나다순
- CSV 내보내기
- 페이지네이션 (20개씩)

### 3.4 Auto-Categorization

**Categories** (8가지):
- Code Review
- Bug Report
- Feature Discussion
- Meeting Schedule
- Question
- Update/Status
- Casual Chat
- Other

**Method**: Gemini API 배치 처리

### 3.5 One-Click Copy

- 번역 결과 옆에 📋 복사 버튼
- 클릭 시 클립보드에 복사
- 토스트 메시지로 피드백

---

## 4. Database Schema

### translations table
```sql
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  korean_text TEXT NOT NULL,
  english_text TEXT NOT NULL,
  model TEXT DEFAULT 'gemini-flash',
  style TEXT DEFAULT 'casual-work',
  category TEXT,
  embedding TEXT,
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

---

## 5. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/translate | 번역 실행 |
| POST | /api/similar | 유사 번역 검색 |
| GET | /api/history | 히스토리 조회 |
| PATCH | /api/history | 번역 업데이트 (즐겨찾기, 카테고리) |
| DELETE | /api/history | 번역 삭제 |
| GET | /api/settings | 설정 조회 |
| PUT | /api/settings | 설정 업데이트 |
| GET | /api/export | CSV 내보내기 |
| POST | /api/categorize | 자동 카테고리 분류 |

---

## 6. User Interface

### Pages
1. **/ (번역)**: 메인 번역 페이지
2. **/history**: 번역 히스토리
3. **/settings**: 설정 및 통계

### Components
- Navigation: 탭 네비게이션
- TranslateForm: 번역 입력 폼
- TranslationResult: 번역 결과 표시
- SimilarModal: 유사 번역 선택 모달
- HistoryList: 히스토리 목록
- HistoryCard: 개별 번역 카드
- SearchFilters: 검색 및 필터
- Toast: 알림 메시지

---

## 7. Environment Variables

### Cloudflare Workers Secrets
- `GEMINI_API_KEY`: Gemini API 키
- `OPENAI_API_KEY`: OpenAI API 키 (임베딩용, 선택)

### GitHub Secrets (CI/CD)
- `CLOUDFLARE_API_TOKEN`: Cloudflare API 토큰
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 ID

---

## 8. Performance Targets

- 번역 응답: < 3초
- 유사 검색: < 200ms (1000개 항목 기준)
- UI 반응성: < 50ms
- 히스토리 로딩: < 500ms

---

## 9. Security

### Authentication
- Cloudflare Access (email whitelist)
- 애플리케이션 레벨 인증 코드 불필요

### Data Security
- HTTPS 전송 암호화
- D1 데이터베이스는 Cloudflare 인프라 내에서 보호
- API 키는 Cloudflare Workers Secrets로 관리

---

## 10. Development

### Local Development
```bash
npm install
npm run dev           # Next.js dev server
npm run dev:wrangler  # Wrangler dev server (with D1)
```

### Database Migrations
```bash
npm run db:migrate:local  # 로컬 마이그레이션
npm run db:migrate:prod   # 프로덕션 마이그레이션
```

### Build & Deploy
```bash
npm run build   # 빌드
npm run deploy  # Cloudflare Workers 배포
```

---

## 11. CI/CD Pipeline

### GitHub Actions Workflow
1. Push to main branch
2. Install dependencies
3. Run database migrations
4. Build Next.js + OpenNext
5. Deploy to Cloudflare Workers

---

## 12. Cost Estimation

**월간 사용 (200번 번역 기준)**:

| Service | Usage | Cost |
|---------|-------|------|
| Gemini Flash Lite | ~100K tokens | ~$0.01 |
| OpenAI Embedding | ~150K tokens | ~$0.003 |
| Cloudflare Workers | Free tier | $0 |
| Cloudflare D1 | Free tier | $0 |
| **Total** | | **~$0.02/월** |

---

## 13. Legacy

원본 단일 HTML 파일 구현은 `legacy/` 폴더에 보존됨.
