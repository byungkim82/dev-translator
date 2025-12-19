# PRD: Korean-English Translation Tool for Slack Communication

## 1. Executive Summary

### Problem Statement
한국인 개발자가 미국 회사에서 영어 네이티브 스피커들과 Slack으로 의사소통할 때:
- 번역기 사용 후 어색한 표현을 수동으로 수정하는 과정이 번거로움
- 자연스러운 영어 표현인지 매번 확인이 필요함
- 번역기 → 수정 → 복사 → 붙여넣기의 반복적인 워크플로우

### Solution
로컬 HTML 파일 기반의 AI 번역 도구로:
- 고품질 AI 모델을 활용한 자연스러운 영어 번역
- 과거 번역 데이터 저장 및 학습 자료 제공
- 유사 번역 추천으로 일관성 유지
- 원클릭 워크플로우

### Success Metrics
- 번역 → 슬랙 입력까지 10초 이내
- 사용자가 수동 수정 없이 번역 결과를 80% 이상 그대로 사용
- 월 200+ 번역 저장 및 재사용

---

## 2. Core Features

### 2.1 AI Translation Engine

**Models (선택 가능)**:
1. **Gemini Flash** (디폴트) - 가장 저렴하고 빠름
2. **Claude Haiku** - 자연스러운 표현
3. **GPT-4o-mini** - 균형잡힌 성능

**Translation Styles (선택 가능)**:
1. **캐주얼 업무용** (디폴트) - "Hey, could you check this?"
2. **격식있는 업무용** - "I would appreciate if you could review this."
3. **매우 캐주얼** - "Can you take a look at this real quick?"
4. **기술 문서용** - "This implementation utilizes..."

**System Prompt Template**:
```
Translate the following Korean text to natural, native-level English appropriate for {STYLE} communication in a US tech company Slack environment. Focus on:
- Natural phrasing that native speakers would use
- Appropriate level of casualness/formality
- Tech industry terminology
- Brevity while maintaining clarity

Korean: {INPUT}
English:
```

### 2.2 Smart Translation History

**Storage**: IndexedDB (Chrome)

**Data Schema**:
```javascript
{
  id: UUID,
  koreanText: string,
  englishText: string,
  model: string,
  style: string,
  category: string | null,
  embedding: float[],  // 임베딩 벡터
  isFavorite: boolean,
  timestamp: ISO8601,
  metadata: {
    charCount: number,
    tokenCount: number,
    confidence: number
  }
}
```

**Capacity**: 수천 개 번역 저장 가능 (IndexedDB는 수백 MB 지원)

### 2.3 Similar Translation Recommendation

**Process**:
1. 사용자가 한국어 입력 후 "번역" 버튼 클릭
2. 입력 텍스트의 임베딩 벡터 생성 (OpenAI text-embedding-3-small API)
3. IndexedDB에서 코사인 유사도 계산
4. 유사도 > 0.85인 과거 번역이 있으면:
   - 모달 팝업으로 최대 3개 유사 번역 표시
   - "이 번역 사용" 또는 "새로 번역" 선택

**UI Flow**:
```
[번역 버튼] → [유사 번역 체크] 
              ↓ 있음                    ↓ 없음
        [유사 번역 모달]              [AI 번역 실행]
         - 번역 1 (유사도 92%)
         - 번역 2 (유사도 87%)
         [이 번역 사용] [새로 번역]
```

**Cost Estimation**:
- text-embedding-3-small: $0.02/1M tokens
- 평균 50 토큰/번역, 하루 100번 → 150K tokens/월
- 월 비용: ~$0.003 (무시 가능)

### 2.4 Auto-Categorization

**Method**: Gemini Flash API (배치 처리)

**Categories** (예시 - AI가 자동 생성):
- Code Review
- Bug Report
- Feature Discussion
- Meeting Schedule
- Question
- Update/Status
- Casual Chat
- Other

**Timing**:
1. 번역 직후: 카테고리 없음 (null)
2. Export/백업 시: 배치로 모든 미분류 번역 분류
3. 사용자가 수동으로 카테고리 수정 가능

**Batch Categorization Prompt**:
```
Categorize these Slack messages into categories. Return JSON array:
[{id: "uuid", category: "Code Review"}, ...]

Messages:
1. [id: xxx] Korean: "이 버그 확인해줄 수 있어?" English: "Can you check this bug?"
...
```

### 2.5 One-Click Copy

**Feature**: 번역 결과 옆에 📋 복사 버튼
- 클릭 시 클립보드에 복사
- 2초간 "복사됨!" 토스트 메시지
- 키보드 단축키: Ctrl/Cmd + Shift + C

---

## 3. User Interface

### 3.1 Tab Structure

```
┌─────────────────────────────────────────┐
│  🌐 Korean → English Translator         │
├─────────────────────────────────────────┤
│  [번역] [히스토리] [설정]               │
├─────────────────────────────────────────┤
│                                          │
│  (탭별 컨텐츠)                          │
│                                          │
└─────────────────────────────────────────┘
```

### 3.2 Tab 1: 번역 (Main Translation)

**Layout**:
```
┌─────────────────────────────────────────┐
│ 모델: [Gemini Flash ▼]                  │
│ 스타일: [캐주얼 업무용 ▼]               │
├─────────────────────────────────────────┤
│  한국어 입력:                            │
│  ┌─────────────────────────────────┐   │
│  │                                  │   │
│  │  (Textarea - 5줄)               │   │
│  │                                  │   │
│  └─────────────────────────────────┘   │
│            [번역하기]                    │
├─────────────────────────────────────────┤
│  영어 결과:                              │
│  ┌─────────────────────────────────┐   │
│  │                                  │   │
│  │  (번역 결과)                     │   │
│  │                                  │   │
│  └─────────────────────────────────┘   │
│  [📋 복사] [⭐ 즐겨찾기] [🗑️ 삭제]     │
└─────────────────────────────────────────┘
```

**Behavior**:
- Enter 키: 번역 실행 (Shift+Enter는 줄바꿈)
- 번역 실행 시 로딩 인디케이터
- 결과 표시 후 자동 스크롤

### 3.3 Tab 2: 히스토리

**Layout**:
```
┌─────────────────────────────────────────┐
│ 🔍 [검색...] [필터 ▼] [내보내기 ▼]     │
├─────────────────────────────────────────┤
│ 정렬: [최신순 ▼] 표시: [전체 ▼]        │
├─────────────────────────────────────────┤
│  📅 2024-01-15 14:23                    │
│  🏷️ Code Review | 📱 Gemini Flash     │
│  KO: "이 버그 확인해줄 수 있어?"        │
│  EN: "Could you check this bug?"        │
│  [📋 복사] [⭐] [🗑️]                   │
├─────────────────────────────────────────┤
│  📅 2024-01-15 10:15                    │
│  🏷️ Meeting | 📱 Claude Haiku          │
│  ...                                     │
└─────────────────────────────────────────┘
```

**Features**:
- **검색**: 한국어/영어 전문 검색
- **필터**:
  - 카테고리별
  - 모델별
  - 스타일별
  - 즐겨찾기만
  - 날짜 범위
- **정렬**:
  - 최신순 (디폴트)
  - 오래된순
  - 가나다순
- **내보내기**:
  - JSON (전체 데이터)
  - CSV (스프레드시트용)
  - PDF (학습 자료용)

### 3.4 Tab 3: 설정

**Sections**:

**1. API Keys**:
```
┌─────────────────────────────────────────┐
│ Claude API Key:                          │
│ [sk-ant-...] [저장] [테스트]            │
│                                          │
│ Gemini API Key:                          │
│ [AIza...] [저장] [테스트]                │
│                                          │
│ OpenAI API Key (임베딩용):               │
│ [sk-...] [저장] [테스트]                 │
│                                          │
│ ⚠️ API 키는 암호화되어 저장됩니다        │
└─────────────────────────────────────────┘
```

**2. Default Settings**:
- 기본 모델 선택
- 기본 스타일 선택
- 자동 복사 (번역 후 자동으로 클립보드에 복사)

**3. Data Management**:
- 저장된 번역 개수: 1,234개
- 사용 용량: 3.2 MB / ~500 MB
- [데이터 초기화] (확인 후 삭제)
- [백업 다운로드] (JSON)
- [백업 가져오기] (JSON)

**4. Auto-Categorization**:
- [미분류 항목 일괄 분류] (현재 45개)
- 마지막 분류: 2024-01-14 23:00

**5. About**:
- 버전: 1.0.0
- 사용 통계:
  - 총 번역: 1,234
  - 이번 주: 87
  - 평균/일: 12.4

---

## 4. Technical Implementation

### 4.1 Tech Stack

- **Single HTML File**: 모든 코드 포함 (HTML + CSS + JS)
- **Storage**: IndexedDB (Dexie.js 라이브러리 사용)
- **UI Framework**: Vanilla JS + Modern CSS (Grid/Flexbox)
- **APIs**:
  - Claude API (anthropic-sdk-js)
  - Gemini API (Google AI SDK)
  - OpenAI API (임베딩)
- **Encryption**: Web Crypto API (AES-GCM)

### 4.2 File Structure

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* CSS - Modern, clean design */
  </style>
</head>
<body>
  <div id="app">
    <!-- UI Structure -->
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.min.js"></script>
  <script>
    // App Logic
    // - API Service Layer
    // - Storage Layer (IndexedDB)
    // - UI Controllers
    // - Event Handlers
  </script>
</body>
</html>
```

### 4.3 Key Functions

**Translation Flow**:
```javascript
async function translate(koreanText, model, style) {
  // 1. 유사 번역 체크
  const similar = await findSimilarTranslations(koreanText);
  if (similar.length > 0) {
    const userChoice = await showSimilarModal(similar);
    if (userChoice !== 'new') return userChoice;
  }
  
  // 2. AI 번역 실행
  const englishText = await callAI(model, koreanText, style);
  
  // 3. 임베딩 생성 & 저장
  const embedding = await getEmbedding(koreanText);
  await saveTranslation({
    koreanText,
    englishText,
    model,
    style,
    embedding,
    timestamp: new Date().toISOString()
  });
  
  return englishText;
}
```

**Similarity Search**:
```javascript
async function findSimilarTranslations(text) {
  const queryEmbedding = await getEmbedding(text);
  const allTranslations = await db.translations.toArray();
  
  const withSimilarity = allTranslations.map(t => ({
    ...t,
    similarity: cosineSimilarity(queryEmbedding, t.embedding)
  }));
  
  return withSimilarity
    .filter(t => t.similarity > 0.85)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}
```

**Export to PDF**:
```javascript
async function exportToPDF(translations) {
  // jsPDF 라이브러리 사용
  const doc = new jsPDF();
  
  translations.forEach((t, i) => {
    doc.text(`${i+1}. ${t.koreanText}`, 10, 10 + i*20);
    doc.text(`   → ${t.englishText}`, 15, 15 + i*20);
  });
  
  doc.save('translations.pdf');
}
```

### 4.4 API Key Encryption

```javascript
async function encryptAPIKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  
  // 사용자 비밀번호 기반 키 생성 (첫 사용 시 설정)
  const cryptoKey = await deriveCryptoKey(userPassword);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv)
  };
}
```

### 4.5 IndexedDB Schema

```javascript
const db = new Dexie('TranslationDB');
db.version(1).stores({
  translations: '++id, timestamp, category, model, style, isFavorite',
  settings: 'key',
  apiKeys: 'provider'
});
```

---

## 5. User Flows

### 5.1 First Time Setup

1. HTML 파일을 로컬에 저장하고 Chrome으로 열기
2. "설정" 탭으로 자동 이동
3. API 키 3개 입력 (Claude, Gemini, OpenAI)
4. 각 키 "테스트" 버튼으로 유효성 확인
5. "저장" → 암호화하여 LocalStorage에 저장
6. "번역" 탭으로 이동하여 사용 시작

### 5.2 Daily Translation Flow

1. 한국어 입력
2. 필요시 모델/스타일 변경
3. "번역하기" 버튼 (또는 Enter)
4. (유사 번역 있으면) 모달에서 선택 또는 "새로 번역"
5. 결과 확인
6. "📋 복사" 버튼 클릭
7. Slack에 붙여넣기

**Time**: ~5초

### 5.3 Learning from History

1. "히스토리" 탭 열기
2. 검색창에 키워드 입력 (예: "버그")
3. 과거 유사 표현들 확인
4. 좋은 표현은 ⭐ 즐겨찾기
5. 정기적으로 PDF로 내보내기하여 학습 자료로 활용

### 5.4 Weekly Backup

1. "설정" 탭 → "Data Management"
2. "백업 다운로드" 클릭
3. `translations_backup_2024-01-15.json` 다운로드
4. Google Drive에 수동 업로드

---

## 6. Performance & Scalability

### 6.1 Performance Targets

- 번역 응답 시간: < 3초 (모델에 따라)
- 유사 번역 검색: < 200ms (1000개 항목 기준)
- UI 반응성: < 50ms
- 히스토리 로딩: < 500ms (1000개 항목)

### 6.2 Optimization Strategies

**임베딩 캐싱**:
- 번역 저장 시 임베딩도 함께 저장
- 검색 시 API 호출 없이 IndexedDB에서 직접 비교

**Lazy Loading**:
- 히스토리는 20개씩 무한 스크롤
- 초기 로딩 속도 개선

**Debouncing**:
- 검색창 입력 시 300ms debounce

### 6.3 Cost Estimation

**월간 사용 (200번 번역 기준)**:

| Service | Usage | Cost |
|---------|-------|------|
| Gemini Flash (150번) | ~75K tokens | $0.01 |
| Claude Haiku (30번) | ~15K tokens | $0.04 |
| GPT-4o-mini (20번) | ~10K tokens | $0.03 |
| OpenAI Embedding | ~150K tokens | $0.003 |
| **Total** | | **~$0.08/월** |

→ 매우 저렴함!

---

## 7. Security & Privacy

### 7.1 Data Storage

- **모든 데이터는 로컬에만 저장** (클라우드 전송 없음)
- IndexedDB는 브라우저 샌드박스 내에서 보호됨
- API 키는 AES-GCM 암호화

### 7.2 API Key Management

- 암호화 후 LocalStorage 저장
- HTTPS 요청만 허용
- API 키는 절대 로그에 기록하지 않음

### 7.3 Export Security

- JSON/CSV 파일에 API 키 포함하지 않음
- 백업 파일 암호화 옵션 제공

---

## 8. Future Enhancements (V2)

### Phase 2 Features:
1. **실시간 번역 제안**: 입력 중 자동완성
2. **음성 입력**: Web Speech API
3. **슬랙 통합**: 직접 슬랙에 전송
4. **팀 공유**: 좋은 번역 패턴 공유
5. **A/B 테스트**: 여러 모델 결과 비교
6. **학습 모드**: 퀴즈 형식으로 복습
7. **Chrome Extension**: 어디서든 사용
8. **다크 모드**

---

## 9. Success Criteria

### MVP Launch (V1.0):
- ✅ 3개 모델 지원
- ✅ 4개 스타일 옵션
- ✅ 유사 번역 추천
- ✅ 히스토리 저장/검색
- ✅ Export (JSON, CSV, PDF)
- ✅ 원클릭 복사

### User Satisfaction:
- 번역 품질 만족도 > 90%
- 수동 수정 필요 < 20%
- 하루 평균 10+ 번역 사용

---

## 10. Implementation Checklist for Claude Code

### Phase 1: Core Functionality
- [ ] HTML/CSS 기본 구조 (3 탭)
- [ ] IndexedDB 설정 (Dexie.js)
- [ ] API Service Layer (Claude, Gemini, GPT, OpenAI Embedding)
- [ ] 번역 기능 (모델/스타일 선택)
- [ ] 번역 결과 저장
- [ ] 복사 버튼

### Phase 2: Smart Features
- [ ] 임베딩 생성 및 저장
- [ ] 유사 번역 검색 (코사인 유사도)
- [ ] 유사 번역 모달 UI
- [ ] 즐겨찾기 기능

### Phase 3: History & Search
- [ ] 히스토리 리스트 렌더링
- [ ] 검색 기능 (한국어/영어)
- [ ] 필터링 (카테고리, 모델, 날짜)
- [ ] 정렬 옵션

### Phase 4: Data Management
- [ ] JSON Export/Import
- [ ] CSV Export
- [ ] PDF Export (jsPDF)
- [ ] 배치 카테고리 분류
- [ ] 데이터 초기화

### Phase 5: Settings & Security
- [ ] API 키 입력/저장 UI
- [ ] API 키 암호화 (Web Crypto API)
- [ ] API 키 테스트 기능
- [ ] 기본 설정 저장
- [ ] 통계 대시보드

### Phase 6: Polish
- [ ] 로딩 인디케이터
- [ ] 토스트 알림
- [ ] 에러 핸들링
- [ ] 반응형 디자인
- [ ] 키보드 단축키
- [ ] 다크 모드 (옵션)

---

## 11. Technical Notes for Claude Code

### API Integration Examples:

**Claude API**:
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })
});
```

**Gemini API**:
```javascript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  }
);
```

**OpenAI Embedding**:
```javascript
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: text
  })
});
```

### Cosine Similarity:
```javascript
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
}
```

---

## 12. File Deliverable

**파일명**: `korean-english-translator.html`

**용량 예상**: ~500KB (모든 라이브러리 인라인 포함)

**브라우저 호환성**: Chrome 90+ (필수: IndexedDB, Web Crypto API)

**외부 의존성**:
- Dexie.js (CDN)
- jsPDF (CDN)
- 없음! 모든 API는 fetch로 직접 호출

---

## 13. Notes

이 PRD는 Claude Code가 바로 구현을 시작할 수 있도록 작성되었습니다. 모든 기술적 세부사항, UI/UX 플로우, 보안 고려사항이 포함되어 있습니다.