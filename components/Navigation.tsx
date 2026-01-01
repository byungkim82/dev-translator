"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "번역" },
  { href: "/history", label: "히스토리" },
  { href: "/settings", label: "설정" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 bg-white rounded-lg p-2 mb-6 shadow-sm">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 py-3 px-4 text-center text-sm font-medium rounded-md transition-all ${
              isActive
                ? "bg-gradient-primary text-white shadow-md"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
