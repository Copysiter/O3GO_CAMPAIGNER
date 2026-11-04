import type { Metadata, Viewport } from "next";
import { ClientRoot } from "./client-root";
import { messages } from "@/lib/messages";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campaigner — O3GO",
  description:
    messages.ru["Управление кампаниями, сообщениями и устройствами O3GO"],
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#26272a" },
    { media: "(prefers-color-scheme: light)", color: "#bfc3c5" },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body>
        <ClientRoot>{children}</ClientRoot>
        <noscript>
          {messages.ru["Для работы Campaigner включите JavaScript в браузере."]}
        </noscript>
      </body>
    </html>
  );
}
