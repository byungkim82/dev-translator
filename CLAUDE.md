# Korean-English Translation Tool - Core Context

## Project Overview
**목표**: 한국인 개발자가 미국 회사 Slack에서 사용할 수 있는 고품질 AI 번역 도구
**형태**: 단일 HTML 파일 (로컬 실행, 빌드 프로세스 없음)
**핵심 가치**: 번역 → Slack 붙여넣기까지 10초 이내, 수동 수정 최소화

## Core Architecture

### Tech Stack (변경 불가)
- **Single HTML File**: 모든 코드 포함 (HTML + CSS + JavaScript)
- **Storage**: IndexedDB (Dexie.js via CDN)
- **UI**: Vanilla JS + Modern CSS (Grid/Flexbox)
- **APIs**: Claude, Gemini, GPT-4o-mini, OpenAI Embedding
- **Security**: Web Crypto API (AES-GCM)
- **Browser**: Chrome 90+ 필수

### File Structure (반드시 준수)
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Korean-English Translator</title>
  <style>
    /* 모든 CSS는 여기에 */
  </style>
</head>
<body>
  <div id="app">
    <!-- 모든 UI 구조 -->
  </div>

  <!-- External Dependencies (CDN only) -->
  <script src="https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

  <script>
    // 모든 JavaScript 로직
  </script>
</body>
</html>
```

---

## UI Structure (3 Tabs)

### Tab 1: 번역 (Main Translation)
- 한국어 입력 textarea
- 모델 선택: Gemini Flash (default) | Claude Haiku | GPT-4o-mini
- 스타일 선택: 캐주얼 업무용 (default) | 격식있는 업무용 | 매우 캐주얼 | 기술 문서용
- 번역하기 버튼 (Enter 키 바인딩)
- 영어 결과 표시 영역
- 복사/즐겨찾기/삭제 버튼

### Tab 2: 히스토리 (History)
- 검색창 (한국어/영어 전문 검색)
- 필터: 카테고리, 모델, 스타일, 즐겨찾기, 날짜 범위
- 정렬: 최신순, 오래된순, 가나다순
- 번역 리스트 (무한 스크롤, 20개씩)
- Export 버튼: JSON, CSV, PDF

### Tab 3: 설정 (Settings)
- API 키 관리 (Claude, Gemini, OpenAI)
- 기본 모델/스타일 설정
- 데이터 관리 (백업, 복원, 초기화)
- 자동 카테고리 분류
- 사용 통계

---

## Data Schema (IndexedDB)

### Database: TranslationDB
```javascript
const db = new Dexie('TranslationDB');
db.version(1).stores({
  translations: '++id, timestamp, category, model, style, isFavorite, koreanText, englishText',
  settings: 'key',
  apiKeys: 'provider'
});
```

### Translation Object (필수 필드)
```javascript
{
  id: string,              // UUID
  koreanText: string,      // 입력 한국어
  englishText: string,     // 번역 결과
  model: string,           // 'gemini-flash' | 'claude-haiku' | 'gpt-4o-mini'
  style: string,           // 'casual-work' | 'formal-work' | 'very-casual' | 'technical-doc'
  category: string | null, // AI가 자동 분류 (초기값 null)
  embedding: float[],      // 1536-dim vector (OpenAI text-embedding-3-small)
  isFavorite: boolean,     // 즐겨찾기 여부
  timestamp: string,       // ISO8601 형식
  metadata: {
    charCount: number,
    tokenCount: number,    // 추정치
    confidence: number     // 0~1
  }
}
```

---

## API Integration (반드시 준수)

### 1. Claude API
```javascript
// Model: claude-haiku-4-20250514
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
    messages: [{ role: 'user', content: prompt }]
  })
});
const data = await response.json();
const translation = data.content[0].text;
```

### 2. Gemini API
```javascript
// Model: gemini-2.0-flash-exp
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  }
);
const data = await response.json();
const translation = data.candidates[0].content.parts[0].text;
```

### 3. GPT-4o-mini API
```javascript
// Model: gpt-4o-mini
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  })
});
const data = await response.json();
const translation = data.choices[0].message.content;
```

### 4. OpenAI Embedding API
```javascript
// Model: text-embedding-3-small (1536 dimensions)
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'text-embedding-3-small',
    input: koreanText
  })
});
const data = await response.json();
const embedding = data.data[0].embedding; // float[1536]
```

---

## Translation Prompt Templates (반드시 사용)

```javascript
const STYLE_PROMPTS = {
  'casual-work': `Translate the following Korean text to natural, casual but professional English appropriate for Slack communication in a US tech company. Use friendly, conversational tone like "Hey, could you check this?" Focus on:
- Natural phrasing that native speakers would use
- Casual but respectful tone
- Tech industry terminology
- Brevity while maintaining clarity

Korean: {INPUT}
English:`,

  'formal-work': `Translate the following Korean text to formal, professional English appropriate for business communication in a US tech company. Use polite, respectful tone like "I would appreciate if you could review this." Focus on:
- Formal business language
- Respectful and courteous tone
- Professional terminology
- Clear and precise communication

Korean: {INPUT}
English:`,

  'very-casual': `Translate the following Korean text to very casual, friendly English appropriate for informal Slack chats with colleagues. Use relaxed tone like "Can you take a look at this real quick?" Focus on:
- Conversational, friendly language
- Informal expressions
- Natural flow
- Brevity

Korean: {INPUT}
English:`,

  'technical-doc': `Translate the following Korean text to technical, precise English appropriate for technical documentation. Use formal technical language like "This implementation utilizes..." Focus on:
- Technical accuracy
- Precise terminology
- Formal documentation style
- Clear technical descriptions

Korean: {INPUT}
English:`
};
```

---

## Core Functions (반드시 구현)

### 1. Translation Flow
```javascript
async function translate(koreanText, model, style) {
  // 1. 유사 번역 체크 (임베딩 기반)
  const similar = await findSimilarTranslations(koreanText);
  if (similar.length > 0) {
    const userChoice = await showSimilarModal(similar);
    if (userChoice !== 'new') return userChoice;
  }

  // 2. AI 번역 실행
  const prompt = STYLE_PROMPTS[style].replace('{INPUT}', koreanText);
  const englishText = await callAI(model, prompt);

  // 3. 임베딩 생성
  const embedding = await getEmbedding(koreanText);

  // 4. IndexedDB에 저장
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

### 2. Similarity Search (코사인 유사도)
```javascript
async function findSimilarTranslations(text) {
  const queryEmbedding = await getEmbedding(text);
  const allTranslations = await db.translations.toArray();

  const withSimilarity = allTranslations
    .filter(t => t.embedding)
    .map(t => ({
      ...t,
      similarity: cosineSimilarity(queryEmbedding, t.embedding)
    }));

  return withSimilarity
    .filter(t => t.similarity > 0.85)  // 유사도 임계값
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);  // 최대 3개
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
}
```

### 3. API Key Encryption (Web Crypto API)
```javascript
async function encryptAPIKey(key, password) {
  const encoder = new TextEncoder();

  // PBKDF2로 비밀번호 기반 키 유도
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const cryptoKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('translator-salt-2024'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // AES-GCM 암호화
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(key)
  );

  return {
    encrypted: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv)
  };
}
```

---

## Categories (자동 분류)

### 8가지 카테고리 (고정)
1. **Code Review**: 코드 리뷰 관련
2. **Bug Report**: 버그 보고
3. **Feature Discussion**: 기능 논의
4. **Meeting Schedule**: 회의 일정
5. **Question**: 질문
6. **Update/Status**: 진행 상황 업데이트
7. **Casual Chat**: 일상 대화
8. **Other**: 기타

### 배치 분류 Prompt (Gemini Flash)
```javascript
const categorizationPrompt = `Categorize these Slack messages into one of these categories: Code Review, Bug Report, Feature Discussion, Meeting Schedule, Question, Update/Status, Casual Chat, Other.

Return only valid JSON array format:
[{"id": "uuid", "category": "Code Review"}, ...]

Messages:
${translations.map((t, i) => `${i+1}. [id: ${t.id}] Korean: "${t.koreanText}" English: "${t.englishText}"`).join('\n')}`;
```

---

## UI/UX Guidelines

### Design Principles
- **심플함**: 불필요한 요소 제거
- **빠른 접근**: 번역 탭이 기본 화면
- **원클릭**: 복사는 한 번의 클릭
- **시각적 피드백**: 로딩, 성공, 에러 상태 명확히

### Color Scheme (권장)
```css
:root {
  --primary: #3b82f6;
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --bg-primary: #ffffff;
  --bg-secondary: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --border: #e5e7eb;
}
```

### Typography
- Font: System UI fonts (-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto)
- Headings: 600 weight
- Body: 400 weight

### Spacing (4px base unit)
- xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px

---

## Performance Targets

- **번역 응답**: < 3초 (모델에 따라 다름)
- **유사 번역 검색**: < 200ms (1000개 항목 기준)
- **UI 반응성**: < 50ms
- **히스토리 로딩**: < 500ms (lazy loading)

---

## Security & Privacy

### API 키 보안
- AES-GCM 암호화 필수
- LocalStorage에 암호화된 형태로만 저장
- 절대 로그에 기록하지 않음
- Export 시 API 키 제외

### 데이터 프라이버시
- 모든 데이터는 로컬 브라우저에만 저장
- 클라우드 전송 없음
- IndexedDB는 브라우저 샌드박스 내에서 보호

---

## Error Handling (모든 Phase에서 적용)

### API 에러 처리
```javascript
async function callAI(model, prompt) {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API 키가 유효하지 않습니다');
      } else if (response.status === 429) {
        throw new Error('API 호출 한도를 초과했습니다');
      } else {
        throw new Error(`API 오류 (${response.status})`);
      }
    }

    return await response.json();
  } catch (error) {
    showToast(`번역 실패: ${error.message}`, 'error');
    throw error;
  }
}
```

### 사용자 친화적 에러 메시지
- API 키 없음: "설정 탭에서 API 키를 입력해주세요"
- 네트워크 오류: "인터넷 연결을 확인해주세요"
- 빈 입력: "번역할 텍스트를 입력해주세요"

---

## Testing Checklist (모든 Phase 완료 후)

### 핵심 기능
- [ ] 3개 모델로 번역 동작
- [ ] 4가지 스타일 적용
- [ ] 유사 번역 추천 (유사도 > 0.85)
- [ ] 복사 기능 (버튼 + 단축키)
- [ ] 즐겨찾기
- [ ] 검색 (한국어/영어)
- [ ] 필터링 (카테고리, 모델, 날짜)
- [ ] Export (JSON, CSV, PDF)
- [ ] API 키 암호화/복호화

### Edge Cases
- [ ] 빈 입력 처리
- [ ] API 키 없을 때
- [ ] API 호출 실패 (401, 429, 500)
- [ ] 네트워크 오류
- [ ] 매우 긴 텍스트 (1000+ 자)
- [ ] 특수문자 처리
- [ ] 데이터 0개일 때 히스토리

---

## Success Criteria (최종 목표)

### 기능 완성도
- ✅ 3개 AI 모델 지원
- ✅ 4가지 번역 스타일
- ✅ 임베딩 기반 유사 번역 추천
- ✅ 히스토리 저장 및 검색
- ✅ Export (JSON, CSV, PDF)
- ✅ 원클릭 복사
- ✅ API 키 암호화

### 사용자 경험
- 번역 → Slack 붙여넣기까지 **10초 이내**
- 수동 수정 없이 **80% 이상 그대로 사용**
- 월 **200+ 번역** 저장 및 재사용

### 성능
- 번역 응답: < 3초
- 유사 검색: < 200ms
- UI 반응: < 50ms

---

## Cost Estimation (참고)

월 200번 사용 기준:
- Gemini Flash (150번): $0.01
- Claude Haiku (30번): $0.04
- GPT-4o-mini (20번): $0.03
- OpenAI Embedding: $0.003
- **Total: ~$0.08/월**

---

## Development Guidelines

### 코드 작성 원칙
1. **단일 파일**: 모든 코드를 하나의 HTML 파일에
2. **CDN 사용**: 외부 라이브러리는 CDN으로만
3. **Vanilla JS**: 프레임워크 없이 순수 JavaScript
4. **Modern CSS**: Grid, Flexbox 활용
5. **명확한 주석**: 각 섹션에 명확한 주석

### 디버깅 팁
- Chrome DevTools → Application 탭에서 IndexedDB 확인
- Console에서 API 호출 로그 확인
- Network 탭에서 API 요청/응답 확인
- Local Storage에서 암호화된 API 키 확인

---

## File Deliverable

**파일명**: `korean-english-translator.html`
**예상 용량**: ~500KB
**브라우저**: Chrome 90+
**외부 의존성**: Dexie.js (CDN), jsPDF (CDN)

---

## Notes

이 문서는 **모든 개발 단계에서 반드시 참조**해야 하는 공통 컨텍스트입니다.
- Phase별 구체적인 구현 플랜은 별도 문서 참조
- 모든 API 호출, 데이터 스키마, 핵심 함수는 이 문서의 사양을 따를 것
- UI/UX, 에러 핸들링, 보안 원칙은 모든 Phase에서 동일하게 적용

**Phase별 구현 플랜**: `PHASES.md` 참조
