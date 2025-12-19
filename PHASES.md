# Implementation Phases - Korean-English Translator

이 문서는 개발 단계별 구체적인 구현 플랜과 체크리스트를 담고 있습니다.
각 Phase는 독립적으로 완성되어 테스트 가능해야 합니다.

**중요**: 모든 Phase에서 `CLAUDE.md`의 공통 사양을 준수해야 합니다.

---

## Phase 1: Core Infrastructure (기반 구조)

### 목표
기본 HTML 구조, IndexedDB 설정, API 통신 레이어 구축

### 구현 항목

#### 1.1 HTML/CSS 기본 구조
**파일**: `korean-english-translator.html`

**HTML 구조**:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Korean-English Translator</title>
  <style>
    /* CSS 코드 */
  </style>
</head>
<body>
  <div id="app">
    <nav class="tabs">
      <button class="tab-btn active" data-tab="translate">번역</button>
      <button class="tab-btn" data-tab="history">히스토리</button>
      <button class="tab-btn" data-tab="settings">설정</button>
    </nav>

    <div id="translate-tab" class="tab-content active">
      <!-- 번역 UI -->
    </div>

    <div id="history-tab" class="tab-content">
      <!-- 히스토리 UI -->
    </div>

    <div id="settings-tab" class="tab-content">
      <!-- 설정 UI -->
    </div>

    <div id="modal-container"></div>
    <div id="toast-container"></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script>
    // JavaScript 코드
  </script>
</body>
</html>
```

**CSS 요구사항**:
- CSS Reset
- CSS 변수 사용 (colors, spacing)
- Grid/Flexbox 레이아웃
- 탭 네비게이션 스타일
- 기본 컴포넌트: 버튼, 입력창, 드롭다운, 카드
- 반응형 브레이크포인트 (mobile, tablet, desktop)

#### 1.2 IndexedDB 설정 (Dexie.js)
**Database Schema**:
```javascript
const db = new Dexie('TranslationDB');
db.version(1).stores({
  translations: '++id, timestamp, category, model, style, isFavorite, koreanText, englishText',
  settings: 'key',
  apiKeys: 'provider'
});
```

**CRUD 헬퍼 함수**:
```javascript
// Create
async function saveTranslation(data) {
  const id = await db.translations.add({
    ...data,
    id: generateUUID(),
    timestamp: new Date().toISOString()
  });
  return id;
}

// Read
async function getTranslations(limit = 20, offset = 0) {
  return await db.translations
    .orderBy('timestamp')
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
}

// Update
async function updateTranslation(id, updates) {
  return await db.translations.update(id, updates);
}

// Delete
async function deleteTranslation(id) {
  return await db.translations.delete(id);
}
```

#### 1.3 API Service Layer
**파일 구조** (단일 HTML 내):
```javascript
// API Service Layer
const APIService = {
  async callClaude(prompt) { /* ... */ },
  async callGemini(prompt) { /* ... */ },
  async callGPT(prompt) { /* ... */ },
  async getEmbedding(text) { /* ... */ }
};
```

**에러 핸들링**:
```javascript
async function apiCall(url, options) {
  try {
    const response = await fetch(url, options);

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
    console.error('API 호출 실패:', error);
    showToast(error.message, 'error');
    throw error;
  }
}
```

#### 1.4 탭 네비게이션
**JavaScript**:
```javascript
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      // Remove active class
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active class
      btn.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });
}
```

### 체크리스트

- [ ] HTML 기본 구조 완성
- [ ] CSS 스타일 완성 (탭, 버튼, 입력창)
- [ ] IndexedDB 초기화 및 스키마 정의
- [ ] CRUD 헬퍼 함수 구현
- [ ] API Service Layer 기본 구조
- [ ] Claude API 통신 함수
- [ ] Gemini API 통신 함수
- [ ] GPT API 통신 함수
- [ ] OpenAI Embedding API 통신 함수
- [ ] 탭 네비게이션 동작
- [ ] 에러 핸들링 기본 구조

### 테스트

- [ ] 탭 전환이 부드럽게 동작
- [ ] IndexedDB가 정상적으로 생성됨 (Chrome DevTools → Application 확인)
- [ ] API 호출 테스트 (콘솔에서 수동 호출)
- [ ] 에러 핸들링 동작 확인

### 산출물

- `korean-english-translator.html` (Phase 1 완료)
- 동작하는 탭 네비게이션
- IndexedDB 초기화 코드
- API 통신 레이어

---

## Phase 2: Translation Engine (번역 엔진)

### 목표
핵심 번역 기능 구현 - 사용자가 실제로 번역을 사용할 수 있는 상태

### 구현 항목

#### 2.1 번역 UI (Tab 1)
**HTML 구조**:
```html
<div id="translate-tab" class="tab-content active">
  <div class="translate-container">
    <div class="controls">
      <select id="model-select">
        <option value="gemini-flash" selected>Gemini Flash</option>
        <option value="claude-haiku">Claude Haiku</option>
        <option value="gpt-4o-mini">GPT-4o-mini</option>
      </select>

      <select id="style-select">
        <option value="casual-work" selected>캐주얼 업무용</option>
        <option value="formal-work">격식있는 업무용</option>
        <option value="very-casual">매우 캐주얼</option>
        <option value="technical-doc">기술 문서용</option>
      </select>
    </div>

    <div class="input-section">
      <label>한국어 입력:</label>
      <textarea id="korean-input" rows="5" placeholder="번역할 텍스트를 입력하세요..."></textarea>
    </div>

    <button id="translate-btn" class="btn btn-primary">번역하기</button>

    <div id="loading-indicator" class="hidden">
      <span class="spinner"></span> 번역 중...
    </div>

    <div id="result-section" class="hidden">
      <label>영어 결과:</label>
      <div id="english-output" class="output-box"></div>
      <div class="action-buttons">
        <button id="copy-btn" class="btn btn-secondary">📋 복사</button>
        <button id="favorite-btn" class="btn btn-secondary">⭐ 즐겨찾기</button>
        <button id="delete-btn" class="btn btn-danger">🗑️ 삭제</button>
      </div>
    </div>
  </div>
</div>
```

#### 2.2 번역 로직
**프롬프트 빌더**:
```javascript
const STYLE_PROMPTS = {
  'casual-work': `Translate the following Korean text to natural, casual but professional English appropriate for Slack communication in a US tech company. Use friendly, conversational tone like "Hey, could you check this?" Focus on:
- Natural phrasing that native speakers would use
- Casual but respectful tone
- Tech industry terminology
- Brevity while maintaining clarity

Korean: {INPUT}
English:`,
  // ... (나머지 스타일들)
};

function buildPrompt(koreanText, style) {
  const template = STYLE_PROMPTS[style] || STYLE_PROMPTS['casual-work'];
  return template.replace('{INPUT}', koreanText);
}
```

**번역 실행**:
```javascript
async function executeTranslation() {
  const koreanText = document.getElementById('korean-input').value.trim();

  if (!koreanText) {
    showToast('번역할 텍스트를 입력해주세요', 'warning');
    return;
  }

  const model = document.getElementById('model-select').value;
  const style = document.getElementById('style-select').value;

  try {
    // Show loading
    showLoading();

    // Build prompt
    const prompt = buildPrompt(koreanText, style);

    // Call AI API
    let englishText;
    switch (model) {
      case 'gemini-flash':
        englishText = await APIService.callGemini(prompt);
        break;
      case 'claude-haiku':
        englishText = await APIService.callClaude(prompt);
        break;
      case 'gpt-4o-mini':
        englishText = await APIService.callGPT(prompt);
        break;
    }

    // Display result
    displayTranslationResult(englishText);

    // Save to IndexedDB
    const translationId = await saveTranslation({
      koreanText,
      englishText,
      model,
      style,
      category: null,
      embedding: null, // Phase 3에서 추가
      isFavorite: false,
      metadata: {
        charCount: koreanText.length,
        tokenCount: estimateTokens(koreanText),
        confidence: 1.0
      }
    });

    // Store current translation ID for actions
    window.currentTranslationId = translationId;

    hideLoading();
    showToast('번역이 완료되었습니다', 'success');

  } catch (error) {
    hideLoading();
    showToast(`번역 실패: ${error.message}`, 'error');
  }
}
```

#### 2.3 UI 헬퍼 함수
```javascript
function showLoading() {
  document.getElementById('loading-indicator').classList.remove('hidden');
  document.getElementById('translate-btn').disabled = true;
}

function hideLoading() {
  document.getElementById('loading-indicator').classList.add('hidden');
  document.getElementById('translate-btn').disabled = false;
}

function displayTranslationResult(englishText) {
  const outputBox = document.getElementById('english-output');
  outputBox.textContent = englishText;
  document.getElementById('result-section').classList.remove('hidden');
}

function estimateTokens(text) {
  // Rough estimation: ~1.3 chars per token for Korean
  return Math.ceil(text.length / 1.3);
}
```

#### 2.4 복사 기능
```javascript
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('복사됨!', 'success');
  } catch (error) {
    showToast('복사 실패', 'error');
  }
}

// Event listener
document.getElementById('copy-btn').addEventListener('click', () => {
  const englishText = document.getElementById('english-output').textContent;
  copyToClipboard(englishText);
});
```

#### 2.5 키보드 단축키
```javascript
document.getElementById('korean-input').addEventListener('keydown', (e) => {
  // Enter: 번역 실행 (Shift+Enter는 줄바꿈)
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    executeTranslation();
  }
});

// Ctrl/Cmd + Shift + C: 복사
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'c') {
    e.preventDefault();
    const copyBtn = document.getElementById('copy-btn');
    if (!copyBtn.disabled) {
      copyBtn.click();
    }
  }
});
```

#### 2.6 토스트 알림 시스템
```javascript
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

**CSS**:
```css
.toast {
  padding: 12px 20px;
  margin-bottom: 10px;
  border-radius: 4px;
  animation: slideIn 0.3s;
}

.toast-success { background: var(--success); color: white; }
.toast-error { background: var(--error); color: white; }
.toast-warning { background: var(--warning); color: white; }

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

### 체크리스트

- [ ] 번역 UI 완성
- [ ] 모델 선택 드롭다운 동작
- [ ] 스타일 선택 드롭다운 동작
- [ ] 한국어 입력 textarea
- [ ] 번역 버튼 동작
- [ ] 로딩 인디케이터
- [ ] 영어 결과 표시
- [ ] 프롬프트 템플릿 (4가지 스타일)
- [ ] AI API 호출 (3개 모델)
- [ ] 번역 결과 저장 (IndexedDB)
- [ ] 복사 버튼
- [ ] 토스트 알림 시스템
- [ ] Enter 키 바인딩
- [ ] Ctrl/Cmd + Shift + C 단축키

### 테스트

- [ ] Gemini Flash로 번역 동작
- [ ] Claude Haiku로 번역 동작
- [ ] GPT-4o-mini로 번역 동작
- [ ] 4가지 스타일 모두 테스트
- [ ] 번역 결과가 IndexedDB에 저장됨
- [ ] 복사 버튼 클릭 시 클립보드에 복사
- [ ] Enter 키로 번역 실행
- [ ] Shift+Enter로 줄바꿈
- [ ] 토스트 알림 표시 및 자동 사라짐
- [ ] 빈 입력 시 경고 메시지

### 산출물

- 완전히 동작하는 번역 기능
- 3개 모델 지원
- 4가지 스타일 지원
- 복사 기능
- 토스트 알림

---

## Phase 3: Smart Features (스마트 기능)

### 목표
임베딩 기반 유사 번역 추천 시스템 구축

### 구현 항목

#### 3.1 임베딩 생성
**OpenAI Embedding API**:
```javascript
async function getEmbedding(text) {
  const apiKey = await getDecryptedAPIKey('openai');

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

  const data = await response.json();
  return data.data[0].embedding; // 1536-dim vector
}
```

**Phase 2 번역 로직에 추가**:
```javascript
// Phase 2의 executeTranslation() 함수 수정
async function executeTranslation() {
  // ... (기존 코드)

  // Generate embedding
  const embedding = await getEmbedding(koreanText);

  // Save with embedding
  await saveTranslation({
    koreanText,
    englishText,
    model,
    style,
    embedding, // 추가
    // ...
  });
}
```

#### 3.2 유사 번역 검색
**코사인 유사도 계산**:
```javascript
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
}

async function findSimilarTranslations(text) {
  // Get embedding for input text
  const queryEmbedding = await getEmbedding(text);

  // Load all translations with embeddings
  const allTranslations = await db.translations.toArray();

  // Calculate similarity
  const withSimilarity = allTranslations
    .filter(t => t.embedding && t.embedding.length === 1536)
    .map(t => ({
      ...t,
      similarity: cosineSimilarity(queryEmbedding, t.embedding)
    }));

  // Filter and sort
  return withSimilarity
    .filter(t => t.similarity > 0.85)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}
```

#### 3.3 유사 번역 모달 UI
**HTML**:
```html
<div id="similar-modal" class="modal hidden">
  <div class="modal-content">
    <h3>유사한 번역을 찾았습니다</h3>
    <p>과거에 비슷한 문장을 번역한 적이 있습니다. 이 번역을 사용하시겠습니까?</p>

    <div id="similar-list"></div>

    <div class="modal-actions">
      <button id="use-similar-btn" class="btn btn-primary">이 번역 사용</button>
      <button id="translate-new-btn" class="btn btn-secondary">새로 번역</button>
    </div>
  </div>
</div>
```

**JavaScript**:
```javascript
async function showSimilarModal(similarTranslations) {
  return new Promise((resolve) => {
    const modal = document.getElementById('similar-modal');
    const listContainer = document.getElementById('similar-list');

    // Render similar translations
    listContainer.innerHTML = similarTranslations.map((t, i) => `
      <div class="similar-item" data-index="${i}">
        <div class="similarity-badge">${Math.round(t.similarity * 100)}% 유사</div>
        <div class="korean">${t.koreanText}</div>
        <div class="english">${t.englishText}</div>
      </div>
    `).join('');

    // Show modal
    modal.classList.remove('hidden');

    let selectedIndex = 0;

    // Select similar translation
    listContainer.querySelectorAll('.similar-item').forEach((item, i) => {
      item.addEventListener('click', () => {
        listContainer.querySelectorAll('.similar-item').forEach(it =>
          it.classList.remove('selected'));
        item.classList.add('selected');
        selectedIndex = i;
      });
    });

    // Use similar
    document.getElementById('use-similar-btn').onclick = () => {
      modal.classList.add('hidden');
      resolve(similarTranslations[selectedIndex].englishText);
    };

    // Translate new
    document.getElementById('translate-new-btn').onclick = () => {
      modal.classList.add('hidden');
      resolve('new');
    };
  });
}
```

**번역 로직 수정**:
```javascript
async function executeTranslation() {
  const koreanText = document.getElementById('korean-input').value.trim();

  if (!koreanText) {
    showToast('번역할 텍스트를 입력해주세요', 'warning');
    return;
  }

  try {
    showLoading();

    // Check for similar translations
    const similar = await findSimilarTranslations(koreanText);

    if (similar.length > 0) {
      hideLoading();
      const userChoice = await showSimilarModal(similar);

      if (userChoice !== 'new') {
        // User chose a similar translation
        displayTranslationResult(userChoice);
        showToast('과거 번역을 사용했습니다', 'success');
        return;
      }

      // User wants new translation
      showLoading();
    }

    // Continue with new translation...
    // (기존 번역 코드)

  } catch (error) {
    hideLoading();
    showToast(`오류: ${error.message}`, 'error');
  }
}
```

#### 3.4 즐겨찾기 기능
```javascript
let currentTranslationId = null;
let currentIsFavorite = false;

document.getElementById('favorite-btn').addEventListener('click', async () => {
  if (!currentTranslationId) return;

  currentIsFavorite = !currentIsFavorite;

  await updateTranslation(currentTranslationId, {
    isFavorite: currentIsFavorite
  });

  // Update button UI
  const btn = document.getElementById('favorite-btn');
  btn.textContent = currentIsFavorite ? '⭐ 즐겨찾기됨' : '⭐ 즐겨찾기';

  showToast(
    currentIsFavorite ? '즐겨찾기에 추가됨' : '즐겨찾기에서 제거됨',
    'success'
  );
});
```

### 체크리스트

- [ ] OpenAI Embedding API 통합
- [ ] 임베딩 생성 함수
- [ ] 번역 저장 시 임베딩 포함
- [ ] 코사인 유사도 계산 함수
- [ ] 유사 번역 검색 함수
- [ ] 유사 번역 모달 UI
- [ ] 모달에서 선택 기능
- [ ] "이 번역 사용" / "새로 번역" 분기
- [ ] 즐겨찾기 토글 기능
- [ ] 즐겨찾기 상태 저장

### 테스트

- [ ] 임베딩이 정상적으로 생성됨 (1536-dim vector)
- [ ] 유사한 번역 입력 시 모달 표시
- [ ] 유사도 > 0.85인 항목만 표시
- [ ] 최대 3개까지만 표시
- [ ] 모달에서 번역 선택 가능
- [ ] "새로 번역" 선택 시 새로 번역 실행
- [ ] 즐겨찾기 토글 동작
- [ ] 즐겨찾기 상태가 IndexedDB에 저장됨

### 산출물

- 유사 번역 자동 추천 시스템
- 즐겨찾기 기능
- 과거 번역 재사용 가능

---

## Phase 4: History & Search (히스토리 & 검색)

### 목표
강력한 검색 및 필터링 기능이 있는 히스토리 탭 구현

### 구현 항목

#### 4.1 히스토리 UI (Tab 2)
**HTML**:
```html
<div id="history-tab" class="tab-content">
  <div class="history-controls">
    <input type="text" id="search-input" placeholder="🔍 검색...">

    <select id="filter-category">
      <option value="">모든 카테고리</option>
      <option value="Code Review">Code Review</option>
      <option value="Bug Report">Bug Report</option>
      <!-- ... -->
    </select>

    <select id="filter-model">
      <option value="">모든 모델</option>
      <option value="gemini-flash">Gemini Flash</option>
      <option value="claude-haiku">Claude Haiku</option>
      <option value="gpt-4o-mini">GPT-4o-mini</option>
    </select>

    <select id="sort-by">
      <option value="newest">최신순</option>
      <option value="oldest">오래된순</option>
      <option value="alphabetical">가나다순</option>
    </select>

    <button id="export-btn" class="btn btn-secondary">내보내기 ▼</button>
  </div>

  <div id="history-list" class="history-list">
    <!-- 번역 카드들 -->
  </div>

  <div id="load-more-btn" class="btn btn-secondary">더 보기</div>
</div>
```

#### 4.2 히스토리 렌더링
```javascript
let currentPage = 0;
const PAGE_SIZE = 20;

async function renderHistory() {
  const searchQuery = document.getElementById('search-input').value.toLowerCase();
  const categoryFilter = document.getElementById('filter-category').value;
  const modelFilter = document.getElementById('filter-model').value;
  const sortBy = document.getElementById('sort-by').value;

  // Load translations
  let translations = await db.translations.toArray();

  // Apply filters
  if (searchQuery) {
    translations = translations.filter(t =>
      t.koreanText.toLowerCase().includes(searchQuery) ||
      t.englishText.toLowerCase().includes(searchQuery)
    );
  }

  if (categoryFilter) {
    translations = translations.filter(t => t.category === categoryFilter);
  }

  if (modelFilter) {
    translations = translations.filter(t => t.model === modelFilter);
  }

  // Apply sorting
  if (sortBy === 'newest') {
    translations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else if (sortBy === 'oldest') {
    translations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } else if (sortBy === 'alphabetical') {
    translations.sort((a, b) => a.koreanText.localeCompare(b.koreanText, 'ko'));
  }

  // Pagination
  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageTranslations = translations.slice(start, end);

  // Render
  const container = document.getElementById('history-list');
  if (currentPage === 0) {
    container.innerHTML = '';
  }

  pageTranslations.forEach(t => {
    const card = createHistoryCard(t);
    container.appendChild(card);
  });

  // Show/hide "Load more" button
  document.getElementById('load-more-btn').style.display =
    end < translations.length ? 'block' : 'none';
}

function createHistoryCard(translation) {
  const card = document.createElement('div');
  card.className = 'history-card';
  card.innerHTML = `
    <div class="card-header">
      <span class="timestamp">${formatDate(translation.timestamp)}</span>
      <span class="badges">
        ${translation.category ? `<span class="badge">${translation.category}</span>` : ''}
        <span class="badge">${translation.model}</span>
      </span>
    </div>
    <div class="card-body">
      <div class="korean-text">${translation.koreanText}</div>
      <div class="english-text">${translation.englishText}</div>
    </div>
    <div class="card-actions">
      <button class="btn-icon" onclick="copyText('${translation.englishText}')">📋</button>
      <button class="btn-icon ${translation.isFavorite ? 'active' : ''}"
        onclick="toggleFavorite('${translation.id}')">⭐</button>
      <button class="btn-icon" onclick="deleteTranslation('${translation.id}')">🗑️</button>
    </div>
  `;
  return card;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
```

#### 4.3 검색 기능 (Debouncing)
```javascript
let searchTimeout;

document.getElementById('search-input').addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage = 0;
    renderHistory();
  }, 300); // 300ms debounce
});
```

#### 4.4 필터링 & 정렬
```javascript
document.getElementById('filter-category').addEventListener('change', () => {
  currentPage = 0;
  renderHistory();
});

document.getElementById('filter-model').addEventListener('change', () => {
  currentPage = 0;
  renderHistory();
});

document.getElementById('sort-by').addEventListener('change', () => {
  currentPage = 0;
  renderHistory();
});
```

#### 4.5 무한 스크롤 (Load More)
```javascript
document.getElementById('load-more-btn').addEventListener('click', () => {
  currentPage++;
  renderHistory();
});
```

### 체크리스트

- [ ] 히스토리 UI 완성
- [ ] 검색창
- [ ] 필터 드롭다운 (카테고리, 모델)
- [ ] 정렬 드롭다운
- [ ] 히스토리 카드 렌더링
- [ ] 검색 기능 (한국어/영어)
- [ ] Debouncing (300ms)
- [ ] 카테고리 필터
- [ ] 모델 필터
- [ ] 정렬 (최신순, 오래된순, 가나다순)
- [ ] 페이지네이션 (20개씩)
- [ ] "더 보기" 버튼
- [ ] 카드에서 복사 버튼
- [ ] 카드에서 즐겨찾기 토글
- [ ] 카드에서 삭제 버튼

### 테스트

- [ ] 히스토리가 정상적으로 표시됨
- [ ] 검색 시 실시간 필터링
- [ ] 카테고리 필터 동작
- [ ] 모델 필터 동작
- [ ] 정렬 동작
- [ ] 20개씩 페이지네이션
- [ ] "더 보기" 클릭 시 추가 로드
- [ ] 카드에서 복사 동작
- [ ] 카드에서 즐겨찾기 토글
- [ ] 카드에서 삭제 동작

### 산출물

- 완전히 동작하는 히스토리 탭
- 검색 및 필터링 기능
- 정렬 기능

---

## Phase 5: Data Management (데이터 관리)

### 목표
Export/Import, 백업, 자동 카테고리 분류 구현

### 구현 항목

#### 5.1 JSON Export/Import
**Export**:
```javascript
async function exportToJSON() {
  const translations = await db.translations.toArray();

  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    count: translations.length,
    translations: translations.map(t => ({
      ...t,
      embedding: undefined // 파일 크기 줄이기
    }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `translations_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  showToast('백업 파일 다운로드 완료', 'success');
}
```

**Import**:
```javascript
async function importFromJSON(file) {
  const text = await file.text();
  const data = JSON.parse(text);

  if (data.version !== '1.0') {
    throw new Error('지원하지 않는 백업 버전입니다');
  }

  // Confirm overwrite
  const confirmed = confirm(
    `${data.count}개의 번역을 가져오시겠습니까?\n기존 데이터에 추가됩니다.`
  );

  if (!confirmed) return;

  // Import translations
  for (const t of data.translations) {
    await db.translations.add({
      ...t,
      id: generateUUID(), // 새 ID 생성
      embedding: null // 임베딩은 다시 생성 필요
    });
  }

  showToast(`${data.count}개의 번역을 가져왔습니다`, 'success');
  renderHistory();
}
```

#### 5.2 CSV Export
```javascript
async function exportToCSV() {
  const translations = await db.translations.toArray();

  const headers = ['Timestamp', 'Korean', 'English', 'Category', 'Model', 'Style'];

  const rows = translations.map(t => [
    t.timestamp,
    `"${t.koreanText.replace(/"/g, '""')}"`,
    `"${t.englishText.replace(/"/g, '""')}"`,
    t.category || '',
    t.model,
    t.style
  ]);

  const csv = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `translations_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();

  showToast('CSV 파일 다운로드 완료', 'success');
}
```

#### 5.3 PDF Export (jsPDF)
```javascript
async function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const translations = await db.translations
    .orderBy('category')
    .toArray();

  let y = 20;
  let pageNumber = 1;

  doc.setFontSize(16);
  doc.text('Korean-English Translations', 10, y);
  y += 10;

  doc.setFontSize(10);
  translations.forEach((t, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
      pageNumber++;
    }

    // Category header
    if (i === 0 || t.category !== translations[i-1].category) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(t.category || 'Uncategorized', 10, y);
      y += 8;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
    }

    // Korean text
    doc.text(`${i+1}. ${t.koreanText}`, 10, y);
    y += 5;

    // English text
    doc.setTextColor(100);
    doc.text(`   → ${t.englishText}`, 15, y);
    doc.setTextColor(0);
    y += 10;
  });

  doc.save('translations.pdf');
  showToast('PDF 파일 다운로드 완료', 'success');
}
```

#### 5.4 자동 카테고리 분류
```javascript
async function categorizeUncategorized() {
  const uncategorized = await db.translations
    .filter(t => !t.category)
    .toArray();

  if (uncategorized.length === 0) {
    showToast('분류할 항목이 없습니다', 'info');
    return;
  }

  showLoading();

  // Build prompt
  const prompt = `Categorize these Slack messages into one of these categories: Code Review, Bug Report, Feature Discussion, Meeting Schedule, Question, Update/Status, Casual Chat, Other.

Return only valid JSON array format:
[{"id": "uuid", "category": "Code Review"}, ...]

Messages:
${uncategorized.map((t, i) =>
  `${i+1}. [id: ${t.id}] Korean: "${t.koreanText}" English: "${t.englishText}"`
).join('\n')}`;

  try {
    // Call Gemini Flash (가장 저렴)
    const result = await APIService.callGemini(prompt);

    // Parse JSON
    const categories = JSON.parse(result);

    // Update database
    for (const item of categories) {
      await updateTranslation(item.id, { category: item.category });
    }

    hideLoading();
    showToast(`${categories.length}개 항목을 분류했습니다`, 'success');
    renderHistory();

  } catch (error) {
    hideLoading();
    showToast(`분류 실패: ${error.message}`, 'error');
  }
}
```

#### 5.5 데이터 초기화
```javascript
async function clearAllData() {
  const confirmed = confirm(
    '정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.'
  );

  if (!confirmed) return;

  // Double confirmation
  const doubleConfirm = confirm('한 번 더 확인합니다. 정말 삭제하시겠습니까?');

  if (!doubleConfirm) return;

  await db.translations.clear();
  await db.settings.clear();

  showToast('모든 데이터가 삭제되었습니다', 'success');
  renderHistory();
}
```

### 체크리스트

- [ ] JSON Export 기능
- [ ] JSON Import 기능
- [ ] CSV Export 기능
- [ ] PDF Export 기능 (jsPDF)
- [ ] 자동 카테고리 분류 (Gemini Flash)
- [ ] 데이터 초기화 기능
- [ ] Export 버튼 드롭다운 메뉴
- [ ] Import 파일 선택 UI
- [ ] 사용 통계 표시 (총 개수, 용량)

### 테스트

- [ ] JSON Export 동작
- [ ] JSON Import 동작 (데이터 복원)
- [ ] CSV Export 동작 (엑셀에서 열기)
- [ ] PDF Export 동작 (가독성 확인)
- [ ] 자동 카테고리 분류 동작
- [ ] 데이터 초기화 동작
- [ ] Export 파일명 형식 확인
- [ ] Import 시 중복 ID 방지

### 산출물

- Export/Import 기능
- PDF 학습 자료 생성
- 자동 카테고리 분류

---

## Phase 6: Settings & Security (설정 & 보안)

### 목표
API 키 관리, 암호화, 설정 저장

### 구현 항목

#### 6.1 API 키 관리 UI (Tab 3)
**HTML**:
```html
<div id="settings-tab" class="tab-content">
  <section class="settings-section">
    <h3>API Keys</h3>
    <p class="warning">⚠️ API 키는 암호화되어 로컬에만 저장됩니다</p>

    <div class="api-key-input">
      <label>Claude API Key:</label>
      <input type="password" id="claude-key" placeholder="sk-ant-...">
      <button class="btn btn-sm" onclick="testAPIKey('claude')">테스트</button>
      <button class="btn btn-sm btn-primary" onclick="saveAPIKey('claude')">저장</button>
    </div>

    <div class="api-key-input">
      <label>Gemini API Key:</label>
      <input type="password" id="gemini-key" placeholder="AIza...">
      <button class="btn btn-sm" onclick="testAPIKey('gemini')">테스트</button>
      <button class="btn btn-sm btn-primary" onclick="saveAPIKey('gemini')">저장</button>
    </div>

    <div class="api-key-input">
      <label>OpenAI API Key (임베딩용):</label>
      <input type="password" id="openai-key" placeholder="sk-...">
      <button class="btn btn-sm" onclick="testAPIKey('openai')">테스트</button>
      <button class="btn btn-sm btn-primary" onclick="saveAPIKey('openai')">저장</button>
    </div>
  </section>

  <section class="settings-section">
    <h3>기본 설정</h3>
    <div class="setting-item">
      <label>기본 모델:</label>
      <select id="default-model">
        <option value="gemini-flash">Gemini Flash</option>
        <option value="claude-haiku">Claude Haiku</option>
        <option value="gpt-4o-mini">GPT-4o-mini</option>
      </select>
    </div>

    <div class="setting-item">
      <label>기본 스타일:</label>
      <select id="default-style">
        <option value="casual-work">캐주얼 업무용</option>
        <option value="formal-work">격식있는 업무용</option>
        <option value="very-casual">매우 캐주얼</option>
        <option value="technical-doc">기술 문서용</option>
      </select>
    </div>

    <div class="setting-item">
      <label>
        <input type="checkbox" id="auto-copy">
        번역 후 자동으로 클립보드에 복사
      </label>
    </div>

    <button class="btn btn-primary" onclick="saveSettings()">설정 저장</button>
  </section>

  <section class="settings-section">
    <h3>데이터 관리</h3>
    <div class="stats">
      <p>저장된 번역: <strong id="total-count">0</strong>개</p>
      <p>사용 용량: <strong id="storage-size">0</strong> KB</p>
    </div>

    <button class="btn btn-secondary" onclick="exportToJSON()">📥 백업 다운로드</button>
    <button class="btn btn-secondary" onclick="triggerImport()">📤 백업 가져오기</button>
    <button class="btn btn-danger" onclick="clearAllData()">🗑️ 데이터 초기화</button>

    <input type="file" id="import-file" accept=".json" style="display:none"
      onchange="handleImport(this.files[0])">
  </section>

  <section class="settings-section">
    <h3>자동 카테고리 분류</h3>
    <p>미분류 항목: <strong id="uncategorized-count">0</strong>개</p>
    <button class="btn btn-primary" onclick="categorizeUncategorized()">
      일괄 분류 실행
    </button>
  </section>

  <section class="settings-section">
    <h3>통계</h3>
    <div class="stats">
      <p>총 번역: <strong id="stat-total">0</strong>개</p>
      <p>이번 주: <strong id="stat-week">0</strong>개</p>
      <p>평균/일: <strong id="stat-avg">0</strong>개</p>
    </div>
  </section>
</div>
```

#### 6.2 API 키 암호화 (Web Crypto API)
```javascript
// 암호화
async function encryptAPIKey(key, password = 'default-password-2024') {
  const encoder = new TextEncoder();

  // Derive key from password
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

  // Encrypt
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

// 복호화
async function decryptAPIKey(encryptedData, password = 'default-password-2024') {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

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

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArrayBuffer(encryptedData.iv) },
    cryptoKey,
    base64ToArrayBuffer(encryptedData.encrypted)
  );

  return decoder.decode(decrypted);
}

// Helper functions
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

#### 6.3 API 키 저장/불러오기
```javascript
async function saveAPIKey(provider) {
  const inputId = `${provider}-key`;
  const key = document.getElementById(inputId).value.trim();

  if (!key) {
    showToast('API 키를 입력해주세요', 'warning');
    return;
  }

  try {
    // Encrypt
    const encrypted = await encryptAPIKey(key);

    // Save to IndexedDB
    await db.apiKeys.put({
      provider,
      encrypted: encrypted.encrypted,
      iv: encrypted.iv
    });

    showToast(`${provider} API 키가 저장되었습니다`, 'success');

  } catch (error) {
    showToast(`저장 실패: ${error.message}`, 'error');
  }
}

async function getDecryptedAPIKey(provider) {
  const apiKeyData = await db.apiKeys.get(provider);

  if (!apiKeyData) {
    throw new Error(`${provider} API 키가 설정되지 않았습니다. 설정 탭에서 API 키를 입력해주세요.`);
  }

  return await decryptAPIKey({
    encrypted: apiKeyData.encrypted,
    iv: apiKeyData.iv
  });
}
```

#### 6.4 API 키 테스트
```javascript
async function testAPIKey(provider) {
  try {
    showToast('API 키 테스트 중...', 'info');

    const key = await getDecryptedAPIKey(provider);

    // Simple test call
    if (provider === 'claude') {
      await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });
    } else if (provider === 'gemini') {
      await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }]
          })
        }
      );
    } else if (provider === 'openai') {
      await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: 'test'
        })
      });
    }

    showToast(`✅ ${provider} API 키가 유효합니다`, 'success');

  } catch (error) {
    showToast(`❌ ${provider} API 키 테스트 실패: ${error.message}`, 'error');
  }
}
```

#### 6.5 기본 설정 저장
```javascript
async function saveSettings() {
  const settings = {
    defaultModel: document.getElementById('default-model').value,
    defaultStyle: document.getElementById('default-style').value,
    autoCopy: document.getElementById('auto-copy').checked
  };

  await db.settings.put({ key: 'userSettings', value: settings });

  showToast('설정이 저장되었습니다', 'success');
}

async function loadSettings() {
  const saved = await db.settings.get('userSettings');

  if (saved) {
    document.getElementById('default-model').value = saved.value.defaultModel;
    document.getElementById('default-style').value = saved.value.defaultStyle;
    document.getElementById('auto-copy').checked = saved.value.autoCopy;
  }
}
```

#### 6.6 통계 계산
```javascript
async function updateStats() {
  const all = await db.translations.toArray();

  // Total count
  document.getElementById('total-count').textContent = all.length;

  // Uncategorized count
  const uncategorized = all.filter(t => !t.category).length;
  document.getElementById('uncategorized-count').textContent = uncategorized;

  // Storage size (rough estimate)
  const size = JSON.stringify(all).length / 1024;
  document.getElementById('storage-size').textContent = size.toFixed(2);

  // This week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const thisWeek = all.filter(t => new Date(t.timestamp) > oneWeekAgo).length;
  document.getElementById('stat-week').textContent = thisWeek;

  // Average per day
  const oldestDate = all.length > 0 ? new Date(all[all.length - 1].timestamp) : new Date();
  const daysSince = Math.max(1, (Date.now() - oldestDate) / (1000 * 60 * 60 * 24));
  const avgPerDay = (all.length / daysSince).toFixed(1);
  document.getElementById('stat-avg').textContent = avgPerDay;

  // Total stat
  document.getElementById('stat-total').textContent = all.length;
}
```

### 체크리스트

- [ ] API 키 입력 UI
- [ ] API 키 암호화 함수
- [ ] API 키 복호화 함수
- [ ] API 키 저장 (IndexedDB)
- [ ] API 키 불러오기
- [ ] API 키 테스트 기능 (3개 모두)
- [ ] 기본 설정 UI
- [ ] 기본 설정 저장/불러오기
- [ ] 데이터 관리 섹션
- [ ] 통계 표시
- [ ] 통계 자동 업데이트

### 테스트

- [ ] API 키 저장 동작
- [ ] API 키가 암호화되어 저장됨 (DevTools 확인)
- [ ] API 키 복호화 동작
- [ ] Claude API 테스트 성공
- [ ] Gemini API 테스트 성공
- [ ] OpenAI API 테스트 성공
- [ ] 잘못된 API 키 시 에러 표시
- [ ] 기본 설정 저장 동작
- [ ] 통계가 정확하게 표시됨

### 산출물

- 안전한 API 키 관리 시스템
- 설정 저장/불러오기
- 사용 통계 표시

---

## Phase 7: Polish & UX (마무리 & UX)

### 목표
사용자 경험 개선, 에러 핸들링, 최적화, 최종 다듬기

### 구현 항목

#### 7.1 UUID 생성
```javascript
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

#### 7.2 전역 에러 핸들링
```javascript
window.addEventListener('error', (event) => {
  console.error('전역 에러:', event.error);
  showToast('예상치 못한 오류가 발생했습니다', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rejection:', event.reason);
  showToast('비동기 작업 중 오류가 발생했습니다', 'error');
});
```

#### 7.3 반응형 CSS
```css
/* Mobile */
@media (max-width: 768px) {
  .tabs {
    flex-direction: column;
  }

  .history-controls {
    flex-direction: column;
  }

  .history-card {
    font-size: 14px;
  }
}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {
  .app-container {
    max-width: 90%;
  }
}

/* Desktop */
@media (min-width: 1025px) {
  .app-container {
    max-width: 1200px;
  }
}
```

#### 7.4 로딩 스피너 CSS
```css
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

#### 7.5 초기화 함수
```javascript
async function init() {
  try {
    // Initialize database
    await db.open();

    // Load settings
    await loadSettings();

    // Initialize tabs
    initTabs();

    // Load history
    await renderHistory();

    // Update stats
    await updateStats();

    // Apply saved settings to UI
    const settings = await db.settings.get('userSettings');
    if (settings) {
      document.getElementById('model-select').value = settings.value.defaultModel;
      document.getElementById('style-select').value = settings.value.defaultStyle;
    }

    console.log('앱 초기화 완료');

  } catch (error) {
    console.error('초기화 실패:', error);
    showToast('앱 초기화 중 오류가 발생했습니다', 'error');
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', init);
```

#### 7.6 빈 상태 처리
```javascript
function renderEmptyState(container, message) {
  container.innerHTML = `
    <div class="empty-state">
      <p>${message}</p>
    </div>
  `;
}

// 히스토리가 비었을 때
if (translations.length === 0) {
  renderEmptyState(
    document.getElementById('history-list'),
    '저장된 번역이 없습니다. 번역 탭에서 번역을 시작해보세요!'
  );
}
```

#### 7.7 성능 최적화
```javascript
// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Throttle utility
function throttle(func, wait) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, wait);
    }
  };
}

// Apply to search
const debouncedSearch = debounce(() => {
  currentPage = 0;
  renderHistory();
}, 300);

document.getElementById('search-input').addEventListener('input', debouncedSearch);
```

#### 7.8 다크 모드 (선택 사항)
```javascript
function toggleDarkMode() {
  const isDark = document.body.dataset.theme === 'dark';
  document.body.dataset.theme = isDark ? 'light' : 'dark';
  localStorage.setItem('theme', document.body.dataset.theme);
}

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.dataset.theme = savedTheme;
```

```css
[data-theme="dark"] {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --border: #374151;
}
```

### 체크리스트

- [ ] UUID 생성 함수
- [ ] 전역 에러 핸들링
- [ ] 반응형 CSS (mobile, tablet, desktop)
- [ ] 로딩 스피너 애니메이션
- [ ] 초기화 함수
- [ ] 빈 상태 UI
- [ ] Debounce/Throttle 유틸리티
- [ ] 성능 최적화
- [ ] 다크 모드 (선택)
- [ ] 모든 에러 케이스 처리
- [ ] 키보드 접근성
- [ ] 사용자 피드백 (토스트, 로딩)

### 최종 테스트

#### 기능 테스트
- [ ] 3개 모델로 번역 동작
- [ ] 4가지 스타일 적용
- [ ] 유사 번역 추천
- [ ] 복사 기능
- [ ] 즐겨찾기
- [ ] 검색
- [ ] 필터링
- [ ] 정렬
- [ ] Export (JSON, CSV, PDF)
- [ ] Import
- [ ] API 키 관리
- [ ] 자동 카테고리 분류

#### Edge Cases
- [ ] 빈 입력 처리
- [ ] API 키 없을 때
- [ ] API 호출 실패 (401, 429, 500)
- [ ] 네트워크 오류
- [ ] 매우 긴 텍스트 (1000+ 자)
- [ ] 특수문자 처리
- [ ] 데이터 0개일 때
- [ ] 잘못된 JSON Import

#### UX 테스트
- [ ] 모든 버튼 클릭 동작
- [ ] 탭 전환 부드러움
- [ ] 모달 열기/닫기
- [ ] 토스트 알림
- [ ] 로딩 인디케이터
- [ ] Enter 키 동작
- [ ] 단축키 동작
- [ ] 반응형 레이아웃 (모바일, 태블릿)

#### 성능 테스트
- [ ] 번역 응답 < 3초
- [ ] 유사 검색 < 200ms
- [ ] 히스토리 로딩 < 500ms
- [ ] UI 반응 < 50ms

### 산출물

- 완성된 `korean-english-translator.html`
- 모든 기능 동작
- 에러 핸들링 완료
- 반응형 디자인
- 사용 준비 완료

---

## 최종 점검 (All Phases 완료 후)

### 코드 품질
- [ ] 모든 함수에 명확한 주석
- [ ] 일관된 네이밍 컨벤션
- [ ] 불필요한 코드 제거
- [ ] Console.log 제거 (프로덕션)

### 보안
- [ ] API 키 암호화 동작
- [ ] LocalStorage에 평문 저장 없음
- [ ] Export 시 API 키 제외
- [ ] HTTPS API 호출만 사용

### 사용자 경험
- [ ] 모든 액션에 피드백 (토스트, 로딩)
- [ ] 에러 메시지가 사용자 친화적
- [ ] 빈 상태 처리
- [ ] 키보드 접근성

### 문서
- [ ] README.md 작성 (사용법)
- [ ] 주요 함수 JSDoc 주석
- [ ] 설정 가이드

### 배포
- [ ] 단일 HTML 파일 확인
- [ ] CDN 링크 유효성 확인
- [ ] 브라우저 호환성 테스트 (Chrome 90+)
- [ ] 파일 크기 확인 (~500KB)

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

## 다음 단계

Phase 1부터 순서대로 진행하세요. 각 Phase 완료 후:
1. 체크리스트 확인
2. 테스트 실행
3. 다음 Phase로 진행

**중요**: 모든 Phase에서 `CLAUDE.md`의 공통 사양을 반드시 준수하세요!
