"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { translate, type Language, type TranslationParams } from "./messages";
export type Translate = (key: string, params?: TranslationParams) => string;
const I18nContext = createContext<{
  language: Language;
  locale: string;
  t: Translate;
}>({
  language: "ru",
  locale: "ru-RU",
  t: (key, params) => translate("ru", key, params),
});
export function I18nProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const t = useCallback<Translate>(
    (key, params) => translate(language, key, params),
    [language],
  );
  const value = useMemo(
    () => ({ language, locale: language === "en" ? "en-US" : "ru-RU", t }),
    [language, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export const useI18n = () => useContext(I18nContext);
export function currentText(key: string, params?: TranslationParams) {
  let language: Language =
    typeof document !== "undefined" && document.documentElement.lang === "en"
      ? "en"
      : "ru";
  try {
    if (
      typeof window !== "undefined" &&
      JSON.parse(window.localStorage.getItem("campaigner.preferences") || "{}")
        .language === "en"
    )
      language = "en";
  } catch {}
  return translate(language, key, params);
}
