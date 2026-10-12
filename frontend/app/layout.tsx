import type { Metadata } from "next";

import "./globals.css";
import { Tektur } from 'next/font/google'

export const metadata: Metadata = {
  title: "Код Ментор",
  description: "Платформа для задач, решений и профессионального развития.",
};

const tektur = Tektur({
  subsets: ['latin', 'cyrillic'], 
  variable: '--font-tektur', 
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="scroll-smooth {tektur.variable}">
      <body className="m-0 min-w-[1440px] bg-[var(--background)] font-[family-name:var(--body)] text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
