"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="p-4">
      <h1 className="text-base font-medium">{t("Страница не найдена")}</h1>
      <Link
        className="mt-4 inline-flex text-primary underline"
        href="/campaigns"
      >
        {t("К кампаниям")}
      </Link>
    </div>
  );
}
