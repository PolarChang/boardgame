import type { Metadata } from "next";
import Link from "next/link";
import { Cinzel, DM_Sans, Cormorant_Garamond, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Board Game Collection — Euro-Classic Ledger",
  description:
    "BoardGameGeek collection showcase and tracker — Premium Euro-Classic Edition",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`h-full ${cinzel.variable} ${dmSans.variable} ${cormorant.variable} ${notoSansTC.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('boardgame-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full parchment-bg text-ink antialiased" style={{ fontFamily: "var(--font-noto-sans-tc), var(--font-dm-sans), system-ui, sans-serif" }}>
        <header className="border-b border-grid-line bg-parchment-light/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
            <Link
              href="/"
              className="font-heading text-sm font-bold tracking-wider text-ink hover:text-brass transition-colors"
            >
              Board Game Collection
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-light transition hover:bg-brass/10 hover:text-ink"
              >
                遊戲牆
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-light transition hover:bg-brass/10 hover:text-ink"
              >
                戰績表
              </Link>
              <Link
                href="/picks"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-light transition hover:bg-brass/10 hover:text-ink"
              >
                精選推薦
              </Link>
              <Link
                href="/rules"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-light transition hover:bg-brass/10 hover:text-ink"
              >
                規則查詢
              </Link>
              <Link
                href="/knowledge"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-light transition hover:bg-brass/10 hover:text-ink"
              >
                規則管理
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
