export const STYLE_PROMPTS: Record<string, string> = {
  "casual-work": `Translate the following Korean text to natural, casual but professional English appropriate for Slack communication in a US tech company. Use friendly, conversational tone. Focus on:
- Natural phrasing that native speakers would use
- Casual but respectful tone
- Tech industry terminology
- Brevity while maintaining clarity
- Match the formality level of the Korean input (formal Korean → more polished English, informal Korean → relaxed English)
- Do NOT add filler openers like "Hey", "Hi", or "So" unless the original Korean explicitly starts with a greeting

Examples:
Korean: 이 부분 확인해줄 수 있어?
English: Could you take a look at this?

Korean: 배포 완료했습니다. 문제 있으면 알려주세요.
English: Deployment's done! Let me know if anything looks off.

Korean: 이 버그 원인이 뭔지 알아?
English: Any idea what's causing this bug?

Korean: {INPUT}

Respond with ONLY the English translation, no explanations.`,

  "formal-work": `Translate the following Korean text to formal, professional English appropriate for business communication in a US tech company. Use polite, respectful tone. Focus on:
- Formal business language
- Respectful and courteous tone
- Professional terminology
- Clear and precise communication
- Match the formality level of the Korean input
- Do NOT add filler openers like "Hey", "Hi", or "So" unless the original Korean explicitly starts with a greeting

Examples:
Korean: 이 PR 검토 부탁드립니다.
English: I would appreciate it if you could review this pull request.

Korean: 일정 확인 후 회신 부탁드립니다.
English: Please review your schedule and get back to me at your earliest convenience.

Korean: 수정 사항 반영했습니다. 확인 부탁드립니다.
English: I have incorporated the requested changes. Please take a moment to review them.

Korean: {INPUT}

Respond with ONLY the English translation, no explanations.`,

  "very-casual": `Translate the following Korean text to very casual, friendly English appropriate for informal Slack chats with close colleagues. Use relaxed, natural tone. Focus on:
- Conversational, friendly language
- Informal contractions and expressions
- Natural flow
- Brevity
- Do NOT add filler openers like "Hey", "Hi", or "So" unless the original Korean explicitly starts with a greeting

Examples:
Korean: 언제쯤 끝날 것 같아?
English: Any idea when you'll wrap this up?

Korean: 나 지금 점심 먹으러 가. 이따 봐.
English: Grabbing lunch, back in a bit!

Korean: 이거 왜 안 되는 거야? 진짜 모르겠네.
English: Ugh, why is this not working? I'm totally lost.

Korean: {INPUT}

Respond with ONLY the English translation, no explanations.`,

  "technical-doc": `Translate the following Korean text to technical, precise English appropriate for technical documentation or engineering specs. Focus on:
- Technical accuracy above all else
- Precise and unambiguous terminology
- Formal documentation style
- Clear technical descriptions

Examples:
Korean: 이 함수는 입력값을 검증하고 정규화된 결과를 반환합니다.
English: This function validates the input and returns a normalized result.

Korean: 캐시 미스 발생 시 데이터베이스에서 직접 조회합니다.
English: On a cache miss, the data is fetched directly from the database.

Korean: 해당 엔드포인트는 인증 토큰이 필요합니다.
English: This endpoint requires a valid authentication token.

Korean: {INPUT}

Respond with ONLY the English translation, no explanations.`,
};

export interface UserContext {
  user_role?: string;
  company_size?: string;
  audience?: string;
}

function buildContextLine(context: UserContext): string {
  const parts: string[] = [];
  if (context.user_role) parts.push(`You are a ${context.user_role}`);
  if (context.company_size) parts.push(`at a ${context.company_size} company`);
  if (context.audience) parts.push(`writing to ${context.audience}`);
  if (parts.length === 0) return "";
  return `\nContext: ${parts.join(" ")}.\n`;
}

export function buildTranslationPrompt(koreanText: string, style: string, context: UserContext = {}): string {
  const template = STYLE_PROMPTS[style] || STYLE_PROMPTS["casual-work"];
  const contextLine = buildContextLine(context);
  return template.replace("Korean: {INPUT}", `${contextLine}Korean: ${koreanText}`);
}

export const CATEGORIES = [
  "Code Review",
  "Bug Report",
  "Feature Discussion",
  "Meeting Schedule",
  "Question",
  "Update/Status",
  "Casual Chat",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function buildCategorizationPrompt(
  translations: Array<{ id: string; korean_text: string; english_text: string }>
): string {
  return `Categorize these Slack messages into one of these categories: ${CATEGORIES.join(", ")}.

Return ONLY a valid JSON array format, no markdown:
[{"id": "uuid", "category": "Code Review"}, ...]

Messages:
${translations.map((t, i) => `${i + 1}. [id: ${t.id}] Korean: "${t.korean_text}" English: "${t.english_text}"`).join("\n")}`;
}
