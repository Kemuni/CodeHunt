import type { Metadata } from "next"
import { auth } from "@/auth"

import "./globals.css"
import { Tektur, Roboto } from "next/font/google"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import { Provider } from "@/components/providers/providers"

const roboto = Roboto({ subsets: ["latin", "cyrillic"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Track Dev",
  description: "Платформа для задач, решений и профессионального развития.",
}

const tektur = Tektur({
  subsets: ["latin", "cyrillic"],
  variable: "--font-tektur",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()

  return (
    <html
      data-scroll-behavior="smooth"
      lang="ru"
      className={cn("scroll-smooth", "font-sans", tektur.variable, roboto.variable)}
    >
      <body className="m-0 w-full bg-background">
        <Provider session={session}>
          <SiteHeader />
          {children}
          <SiteFooter />
        </Provider>
      </body>
    </html>
  )
}
