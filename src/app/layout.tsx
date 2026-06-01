import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "全球产业雷达",
  description: "Public-market momentum to primary-investment signals"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
