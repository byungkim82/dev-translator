import { describe, expect, it } from "vitest";
import {
  buildCategorizationPrompt,
  buildGlossaryLine,
  buildReadingPrompt,
  buildTranslationPrompt,
  CATEGORIES,
  CODE_PRESERVATION_RULE,
} from "./prompts";

describe("buildTranslationPrompt", () => {
  it("substitutes the Korean text into the template", () => {
    const prompt = buildTranslationPrompt("이거 확인해줘", "casual-work");
    expect(prompt).toContain("Korean: 이거 확인해줘");
  });

  it("uses the requested style template", () => {
    const prompt = buildTranslationPrompt("테스트", "technical-doc");
    expect(prompt).toContain("technical documentation or engineering specs");
  });

  it("falls back to the casual-work template for an unknown style", () => {
    const prompt = buildTranslationPrompt("테스트", "does-not-exist");
    expect(prompt).toContain("casual but professional English");
  });

  it("omits the context line when no user context is given", () => {
    const prompt = buildTranslationPrompt("테스트", "casual-work");
    expect(prompt).not.toContain("Context:");
  });

  it("injects a context line built from user context", () => {
    const prompt = buildTranslationPrompt("테스트", "casual-work", {
      user_role: "backend engineer",
      company_size: "startup",
      audience: "my manager",
    });
    expect(prompt).toContain(
      "Context: You are a backend engineer at a startup company writing to my manager."
    );
  });

  it("includes only the provided context fields", () => {
    const prompt = buildTranslationPrompt("테스트", "casual-work", {
      user_role: "PM",
    });
    expect(prompt).toContain("Context: You are a PM.");
    // Only user_role was provided, so the company-size / audience fragments
    // must not be injected into the context line.
    expect(prompt).not.toContain("at a ");
    expect(prompt).not.toContain("writing to");
  });

  it("injects the code-preservation rule for every style", () => {
    for (const style of [
      "casual-work",
      "formal-work",
      "very-casual",
      "technical-doc",
    ]) {
      const prompt = buildTranslationPrompt("이 PR을 staging에 deploy 했어", style);
      expect(prompt).toContain(CODE_PRESERVATION_RULE);
    }
  });

  it("injects the code-preservation rule even for an unknown style (fallback)", () => {
    const prompt = buildTranslationPrompt("rebase 부탁해", "does-not-exist");
    expect(prompt).toContain(CODE_PRESERVATION_RULE);
  });

  it("injects the glossary block when glossary text is provided", () => {
    const prompt = buildTranslationPrompt("결제 확인해줘", "casual-work", {}, "결제 → payments");
    expect(prompt).toContain("결제 → payments");
    expect(prompt).toContain("Glossary");
  });

  it("omits the glossary block when no glossary is given", () => {
    const prompt = buildTranslationPrompt("결제 확인해줘", "casual-work");
    expect(prompt).not.toContain("Glossary");
  });

  it("injects personalized few-shot examples when provided", () => {
    const prompt = buildTranslationPrompt("리뷰 부탁해", "casual-work", {}, undefined, [
      { korean: "이 코드 리뷰해줄 수 있어?", english: "Mind giving this a review?" },
    ]);
    expect(prompt).toContain("match this voice");
    expect(prompt).toContain("Mind giving this a review?");
  });

  it("omits the examples block when none are given", () => {
    const prompt = buildTranslationPrompt("리뷰 부탁해", "casual-work");
    expect(prompt).not.toContain("match this voice");
  });
});

describe("buildReadingPrompt (F11 reading mode)", () => {
  it("substitutes the English text into the prompt", () => {
    const prompt = buildReadingPrompt("Can you take a look at this PR?");
    expect(prompt).toContain("English: Can you take a look at this PR?");
  });

  it("asks for Korean-only output", () => {
    expect(buildReadingPrompt("hi")).toContain("Respond with ONLY the Korean translation");
  });

  it("instructs to keep English technical terms in English (reverse code preservation)", () => {
    expect(buildReadingPrompt("we will deploy")).toContain("Keep English technical terms");
  });

  it("has no work-style variants (single prompt)", () => {
    // Sanity: the reading prompt must not carry the KO→EN style scaffolding.
    const prompt = buildReadingPrompt("test");
    expect(prompt).not.toContain("casual but professional English");
  });
});

describe("buildGlossaryLine", () => {
  it("returns an empty string for undefined / blank glossary (no-op)", () => {
    expect(buildGlossaryLine(undefined)).toBe("");
    expect(buildGlossaryLine("")).toBe("");
    expect(buildGlossaryLine("   \n\t ")).toBe("");
  });

  it("wraps non-empty glossary text in a labeled block", () => {
    const line = buildGlossaryLine("결제 → payments");
    expect(line).toContain("결제 → payments");
    expect(line).toContain("Glossary");
  });
});

describe("buildCategorizationPrompt", () => {
  const messages = [
    { id: "id-1", korean_text: "버그 있어요", english_text: "There's a bug" },
    { id: "id-2", korean_text: "점심 같이 먹어요", english_text: "Let's grab lunch" },
  ];

  it("lists every available category", () => {
    const prompt = buildCategorizationPrompt(messages);
    for (const category of CATEGORIES) {
      expect(prompt).toContain(category);
    }
  });

  it("includes each message's id and texts", () => {
    const prompt = buildCategorizationPrompt(messages);
    expect(prompt).toContain("id: id-1");
    expect(prompt).toContain("버그 있어요");
    expect(prompt).toContain("Let's grab lunch");
  });

  it("asks for a JSON array response", () => {
    const prompt = buildCategorizationPrompt(messages);
    expect(prompt).toContain("JSON array");
  });
});
