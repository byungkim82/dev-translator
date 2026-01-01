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
      <body className="bg-gray-100 text-gray-900 min-h-screen">
        <Providers>
          <div className="max-w-4xl mx-auto p-4 md:p-6">
            <header className="text-center mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">
                Dev Translator
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                한국어 → 영어 번역
              </p>
            </header>
            <Navigation />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
