import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure-logic unit tests run in plain Node — no DOM/Next runtime needed.
    environment: "node",
    include: ["{lib,app,components}/**/*.test.ts"],
  },
  resolve: {
    // Mirror the tsconfig "@/*" path alias so tests can import like the app does.
    alias: {
      "@": resolve(__dirname),
    },
  },
});
