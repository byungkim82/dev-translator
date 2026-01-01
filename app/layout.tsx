import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Dev Translator - Korean to English",
  description: "AI-powered Korean to English translation tool for developers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-gradient-page text-gray-900">
        <Providers>
          <div className="max-w-4xl mx-auto p-4 md:p-6">
            <header className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xl">
                  ✨
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    Dev Translator
                  </h1>
                  <p className="text-sm text-gray-500">
                    한 → 영 번역
                  </p>
                </div>
              </div>
            </header>
            <Navigation />
            <main>{children}</main>
            <footer className="mt-8 text-center">
              <p className="text-xs text-gray-400">
                Powered by Gemini 1.5 Flash
              </p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
