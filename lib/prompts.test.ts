import { describe, expect, it } from "vitest";
import {
  buildCategorizationPrompt,
  buildTranslationPrompt,
  CATEGORIES,
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
