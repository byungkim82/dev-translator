# 🌐 Korean-English Translation Tool

한국인 개발자가 미국 회사 Slack에서 사용할 수 있는 고품질 AI 번역 도구입니다.

## ✨ 주요 기능

- **3가지 AI 모델 지원**: Gemini 2.5 Flash Lite, Gemini 3.0 Flash, GPT-4o-mini
- **4가지 번역 스타일**: 캐주얼 업무용, 격식있는 업무용, 매우 캐주얼, 기술 문서용
- **스마트 유사 번역 추천**: OpenAI Embedding 기반 (코사인 유사도 > 0.85)
- **강력한 히스토리 관리**: 검색, 필터링, 정렬, 즐겨찾기
- **데이터 관리**: JSON/CSV/PDF Export, Import, 백업/복원
- **자동 카테고리 분류**: 8가지 카테고리 (Code Review, Bug Report, 등)
- **보안**: AES-GCM 암호화로 API 키 로컬 저장
- **단일 HTML 파일**: 빌드 프로세스 없이 바로 사용 가능

## 🚀 빠른 시작

### 1. 파일 다운로드

```bash
# 저장소 클론
git clone https://github.com/YOUR_USERNAME/korean-english-translator.git
cd korean-english-translator

# 또는 파일 직접 다운로드
# korean-english-translator.html 파일만 다운로드하면 됩니다
```

### 2. 브라우저에서 열기

```bash
# 방법 1: 파일 더블클릭
open korean-english-translator.html

# 방법 2: 로컬 서버 사용 (권장)
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000/korean-english-translator.html 열기
```

### 3. API 키 설정

1. **설정 탭** 클릭
2. 사용할 모델의 API 키 입력:
   - **Gemini API**: https://aistudio.google.com/app/apikey
   - **OpenAI API**: https://platform.openai.com/api-keys
3. **저장** 버튼 클릭
4. **테스트** 버튼으로 연결 확인

### 4. 번역 시작!

1. **번역 탭**에서 한국어 입력
2. 모델과 스타일 선택
3. **번역하기** 버튼 클릭 (또는 Enter)
4. 결과를 복사하여 Slack에 붙여넣기

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

## 🧪 테스트 모드

내장형 자동화 테스트를 실행하려면:

```
http://localhost:8000/korean-english-translator.html?test
```

- **14개 자동화 테스트** 포함
- 콘솔에서 상세 로그 확인
- 우측 하단에 결과 UI 패널 표시

테스트 커버리지:
- ✅ 순수 함수 (코사인 유사도, 날짜 포맷, XSS 방지)
- ✅ IndexedDB CRUD 연산
- ✅ 필터링 및 정렬 로직

자세한 내용: [EMBEDDED_TESTS.md](./EMBEDDED_TESTS.md)

## 📁 파일 구조

```
dev-translator/
├── korean-english-translator.html  # 메인 애플리케이션 (단일 파일)
├── CLAUDE.md                       # 프로젝트 컨텍스트 및 사양
├── EMBEDDED_TESTS.md               # 테스트 가이드
├── PHASE2_TEST.md                  # Phase 2 테스트 체크리스트
├── PHASE3_TEST.md                  # Phase 3 테스트 체크리스트
├── PHASE4_TEST.md                  # Phase 4 테스트 체크리스트
├── PHASE5_COMPLETE.md              # Phase 5 완료 문서
└── README.md                       # 이 파일
```

## 🛠️ 기술 스택

- **Frontend**: Vanilla JavaScript, Modern CSS (Grid/Flexbox)
- **Storage**: IndexedDB (Dexie.js)
- **Security**: Web Crypto API (AES-GCM)
- **AI Models**:
  - Google Gemini 2.5 Flash Lite
  - Google Gemini 3.0 Flash
  - OpenAI GPT-4o-mini
  - OpenAI text-embedding-3-small (1536 dimensions)
- **Export**: jsPDF (PDF 생성)
- **Browser**: Chrome 90+

## 💰 비용 추정

월 200번 사용 기준:
- Gemini Flash (150번): ~$0.01
- GPT-4o-mini (50번): ~$0.03
- OpenAI Embedding (200번): ~$0.003
- **총계**: ~$0.04/월

## 🔒 보안 & 프라이버시

- ✅ API 키는 AES-GCM 암호화하여 로컬 브라우저에만 저장
- ✅ 모든 번역 데이터는 IndexedDB에 로컬 저장
- ✅ 클라우드 전송 없음 (API 호출 제외)
- ✅ Export 시 API 키 제외
- ✅ XSS 방지 (HTML 이스케이프)

## 📊 주요 통계

- **테스트 케이스**: 14개 자동화 + 59개 수동
- **코드 라인**: ~3,000줄 (단일 HTML 파일)
- **지원 브라우저**: Chrome 90+, Edge 90+
- **파일 크기**: ~150KB (압축 전)

## 🎯 성능 목표

| 메트릭 | 목표 | 상태 |
|--------|------|------|
| 번역 응답 시간 | < 3초 | ✅ |
| 유사 번역 검색 | < 200ms | ✅ |
| UI 반응성 | < 50ms | ✅ |
| 히스토리 로딩 | < 500ms | ✅ |

## 🤝 기여 방법

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

MIT License - 자유롭게 사용하세요!

## 🐛 버그 리포트 & 기능 요청

Issues 탭에서 버그 리포트나 기능 요청을 남겨주세요.

## 📮 연락처

프로젝트 Link: [https://github.com/YOUR_USERNAME/korean-english-translator](https://github.com/YOUR_USERNAME/korean-english-translator)

## 🙏 감사의 말

- **Claude AI**: 코드 생성 및 테스트
- **Google Gemini**: 고품질 번역 제공
- **OpenAI**: GPT 모델 및 Embedding
- **Dexie.js**: 강력한 IndexedDB wrapper
- **jsPDF**: PDF 생성 라이브러리

---

**Made with ❤️ for Korean developers working in US companies**
