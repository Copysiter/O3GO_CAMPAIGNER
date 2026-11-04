"use client";
import dynamic from "next/dynamic";
import { currentText } from "@/lib/i18n";
const Workspace = dynamic(() => import("./workspace"), {
  ssr: false,
  loading: () => (
    <div className="boot-screen" role="status">
      {currentText("Загрузка рабочего пространства…")}
    </div>
  ),
});
export function ClientRoot({ children }: { children: React.ReactNode }) {
  return <Workspace>{children}</Workspace>;
}
