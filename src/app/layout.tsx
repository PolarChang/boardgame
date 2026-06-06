import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Board Game Collection",
  description: "BoardGameGeek collection showcase and tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-50">
        <header className="border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
            <Link href="/" className="text-sm font-bold tracking-tight">
              Board Game Collection
            </Link>
            <nav className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-900 dark:hover:text-white"
              >
                遊戲牆
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-900 dark:hover:text-white"
              >
                戰績儀表板
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
