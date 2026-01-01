export const STYLE_PROMPTS: Record<string, string> = {
  "casual-work": `Translate the following Korean text to natural, casual but professional English appropriate for Slack communication in a US tech company. Use friendly, conversational tone like "Hey, could you check this?" Focus on:
- Natural phrasing that native speakers would use
- Casual but respectful tone
- Tech industry terminology
- Brevity while maintaining clarity

Korean: {INPUT}

Respond with ONLY the English translation, no explanations.`,

  "formal-work": `Translate the following Korean text to formal, professional English appropriate for business communication in a US tech company. Use polite, respectful tone like "I would appreciate if you could review this." Focus on:
- Formal business language
- Respectful and courteous tone
- Professional terminology
- Clear and precise communication

Korean: {INPUT}

Respond with ONLY the English translation, no explanations.`,

  "very-casual": `Translate the following Korean text to very casual, friendly English appropriate for informal Slack chats with colleagues. Use relaxed tone like "Can you take a look at this real quick?" Focus on:
- Conversational, friendly language
- Informal expressions
- Natural flow
- Brevity

Korean: {INPUT}

Respond with ONLY the English translation, no explanations.`,

  "technical-doc": `Translate the following Korean text to technical, precise English appropriate for technical documentation. Use formal technical language like "This implementation utilizes..." Focus on:
- Technical accuracy
- Precise terminology
- Formal documentation style
- Clear technical descriptions

Korean: {INPUT}

Respond with ONLY the English translation, no explanations.`,
};

export function buildTranslationPrompt(koreanText: string, style: string): string {
  const template = STYLE_PROMPTS[style] || STYLE_PROMPTS["casual-work"];
  return template.replace("{INPUT}", koreanText);
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
