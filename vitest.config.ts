import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Enables JSX/TSX transform (automatic runtime) for React component tests.
  plugins: [react()],
  test: {
    // Pure-logic unit tests run in plain Node; React component tests opt into
    // jsdom per-file via a `// @vitest-environment jsdom` pragma.
    environment: "node",
    include: ["{lib,app,components}/**/*.test.{ts,tsx}"],
  },
  resolve: {
    // Mirror the tsconfig "@/*" path alias so tests can import like the app does.
    alias: {
      "@": resolve(__dirname),
    },
  },
});
