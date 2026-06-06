import type { Metadata } from "next";
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
