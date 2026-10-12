import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Код Ментор",
  description: "Платформа для задач, решений и профессионального развития.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="scroll-smooth">
      <body className="m-0 min-w-[1440px] bg-[var(--background)] font-[family-name:var(--body)] text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
