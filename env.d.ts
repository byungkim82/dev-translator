/// <reference types="@cloudflare/workers-types" />

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    AI: Ai;
    GEMINI_API_KEY: string;
    OPENAI_API_KEY: string;
    ASSETS: Fetcher;
  }

  namespace NodeJS {
    interface ProcessEnv {
      GEMINI_API_KEY?: string;
      OPENAI_API_KEY?: string;
    }
  }
}

export {};
