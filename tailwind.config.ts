import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
      },
    },
  },
  plugins: [],
} satisfies Config;
