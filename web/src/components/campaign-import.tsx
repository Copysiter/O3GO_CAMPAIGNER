"use client";

import { LoaderCircle } from "lucide-react";
import type {
  CampaignImportMapping,
  CampaignImportPreview,
  CampaignImportUpload,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ErrorBox } from "./common";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";

const fieldNames = ["dst_addr", "field_1", "field_2", "field_3", "field_4", "field_5"];

export function initialImportMappings(upload: CampaignImportUpload): CampaignImportMapping[] {
  return (upload.sources || []).map((source) => {
    const columns = source.column_count || Math.max(1, ...source.sample_rows.map((row) => row.length));
    return {
      source_id: source.id,
      data_fields: upload.format === "zip"
        ? { dst_addr: 0, field_1: null, field_2: null, field_3: null, field_4: null, field_5: null }
        : source.suggested_fields || Object.fromEntries(fieldNames.map((key, index) => [key, index < columns ? index : null])),
      skip_rows: upload.format === "zip" ? 0 : source.suggested_skip_rows || 0,
    };
  });
}

export function CampaignImportFields({
  upload,
  mappings,
  onChange,
  defaultRegion,
  onDefaultRegionChange,
}: {
  upload: CampaignImportUpload;
  mappings: CampaignImportMapping[];
  onChange: (mappings: CampaignImportMapping[]) => void;
  defaultRegion: string;
  onDefaultRegionChange: (region: string) => void;
}) {
  const { t, locale } = useI18n();
  const sources = upload.sources || [];
  const zip = upload.format === "zip";
  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t(zip ? "Номера из архива" : "Сопоставление колонок")}</h3>
        <p className="text-xs leading-relaxed text-form-caption">
          {t(zip
            ? "Все TXT со списками объединены. В каждой строке архива принимается только телефон; text.txt задаёт общее сообщение."
            : "Выберите телефон и дополнительные поля для каждого листа. Заголовок можно исключить из получателей.")}
        </p>
      </div>
      {sources.map((source) => {
        const mapping = mappings.find((item) => item.source_id === source.id);
        if (!mapping) return null;
        const columns = source.column_count || Math.max(1, ...source.sample_rows.map((row) => row.length));
        const sample = source.sample_rows[mapping.skip_rows] || source.sample_rows[0] || [];
        const update = (next: Partial<CampaignImportMapping>) => onChange(mappings.map((item) =>
          item.source_id === source.id ? { ...item, ...next } : item));
        return (
          <section key={source.id} className="field-group-surface min-w-0 space-y-3 border p-3">
            <div className="flex min-w-0 flex-wrap justify-between gap-2 text-xs">
              <strong className="min-w-0 break-all">{source.name}</strong>
              <span className="text-form-caption">{t("Строк: {count}", { count: source.row_count.toLocaleString(locale) })}</span>
            </div>
            {!zip && (
              <>
                <label className="flex min-h-9 cursor-pointer items-center gap-3 text-sm">
                  <Checkbox aria-label={sources.length === 1 ? t("Первая строка — названия колонок") : `${t("Первая строка — названия колонок")} · ${source.name}`} checked={mapping.skip_rows > 0} onCheckedChange={(checked) => update({ skip_rows: checked ? 1 : 0 })} />
                  {t("Первая строка — названия колонок")}
                </label>
                <div className="form-flow form-flow-thirds">
                  {fieldNames.map((key, fieldIndex) => {
                    const label = fieldIndex === 0 ? t("Колонка телефона") : t("Колонка поля {index}", { index: fieldIndex });
                    return (
                      <label key={key} className="form-field min-w-0">
                        <span>{fieldIndex === 0 ? t("Телефон *") : t("Поле {index} · {field}", { index: fieldIndex, field: `{field_${fieldIndex}}` })}</span>
                        <select
                          aria-label={sources.length === 1 ? label : `${label} · ${source.name}`}
                          className="native-select min-w-0 w-full"
                          value={mapping.data_fields[key] ?? ""}
                          onChange={(event) => update({ data_fields: { ...mapping.data_fields, [key]: event.target.value === "" ? null : Number(event.target.value) } })}
                        >
                          <option value="">{t(fieldIndex === 0 ? "Выберите колонку" : "Не использовать")}</option>
                          {Array.from({ length: columns }, (_, column) => (
                            <option key={column} value={column}>
                              {t("Колонка {index}", { index: column + 1 })}{sample[column] ? ` · ${String(sample[column]).slice(0, 35)}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
            <div className="form-table-scroll max-w-full overflow-x-auto border" tabIndex={0} aria-label={t("Предпросмотр колонок получателей")}>
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary"><tr>
                  {Array.from({ length: columns }, (_, column) => <th key={column} className="whitespace-nowrap border-r px-3 py-2 font-medium">{t("Колонка {index}", { index: column + 1 })}</th>)}
                </tr></thead>
                <tbody>{source.sample_rows.slice(0, 5).map((values, rowIndex) => <tr key={rowIndex} className={`border-t ${rowIndex < mapping.skip_rows ? "text-muted-foreground line-through" : ""}`}>
                  {Array.from({ length: columns }, (_, column) => <td key={column} className="max-w-56 border-r px-3 py-2"><span className="line-clamp-2 break-words">{values[column] || "—"}</span></td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </section>
        );
      })}
      <label className="form-field">
        <span>{t("Страна для местных номеров")}</span>
        <Input value={defaultRegion} maxLength={2} placeholder="RU" aria-label={t("Страна для местных номеров")}
          onChange={(event) => onDefaultRegionChange(event.target.value.replace(/[^a-z]/gi, "").toUpperCase())} />
        <span className="text-xs font-normal leading-relaxed text-form-caption">{t("Оставьте пустым для международных номеров. Для местного формата укажите код страны, например RU или KZ.")}</span>
      </label>
      {!!upload.warnings?.length && <ul className="space-y-1 text-xs text-form-caption">{upload.warnings.map((warning, index) => <li key={index}>{t(warning)}</li>)}</ul>}
    </div>
  );
}

export function CampaignImportSummary({
  preview,
  loading,
  error,
  split,
  name,
  excludeInvalid,
  onExcludeInvalidChange,
}: {
  preview: CampaignImportPreview | null;
  loading: boolean;
  error: unknown;
  split: boolean;
  name: string;
  excludeInvalid: boolean;
  onExcludeInvalidChange: (exclude: boolean) => void;
}) {
  const { t, locale } = useI18n();
  if (error) return <ErrorBox error={error} />;
  if (loading || !preview) return <div role="status" className="flex items-center gap-2 p-3 text-sm text-form-caption"><LoaderCircle size={16} className="animate-spin" />{t("Проверяем номера и определяем GEO…")}</div>;
  const groups = split ? preview.geo_groups : [{ geo: null, count: preview.valid_count }];
  return (
    <section className="campaign-preview min-w-0 space-y-3 border p-3" aria-label={t("Предпросмотр создаваемых рассылок")}>
      <h3 className="text-sm font-medium">{t("Будут созданы рассылки: {count}", { count: preview.valid_count ? groups.length : 0 })}</h3>
      <p className="text-xs text-form-caption">{t("Принято строк: {valid}. С ошибками: {invalid}.", { valid: preview.valid_count.toLocaleString(locale), invalid: preview.invalid_count.toLocaleString(locale) })}</p>
      {preview.valid_count > 0 && <ul className="form-summary-list divide-y border-y">{groups.map((group, index) => <li key={`${group.geo}-${index}`} className="flex min-w-0 items-start justify-between gap-3 py-2 text-sm">
        <span className="min-w-0 break-words">{split ? `[${(group.geo || "unknown").toLowerCase()}] ` : ""}{name || t("Без названия")}</span>
        <span className="shrink-0 tabular-nums">{group.count.toLocaleString(locale)}</span>
      </li>)}</ul>}
      <p className="text-xs leading-relaxed text-form-caption">{t("Количество строк для отправки. Повторяющиеся номера сохраняются. Рассылки создаются без запуска.")}</p>
      {preview.invalid_count > 0 && <div className="space-y-3">
        <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
          <Checkbox aria-label={t("Пропустить строки с ошибками ({count})", { count: preview.invalid_count })} checked={excludeInvalid} onCheckedChange={(checked) => onExcludeInvalidChange(checked === true)} />
          {t("Пропустить строки с ошибками ({count})", { count: preview.invalid_count })}
        </label>
        <ul className="max-h-40 space-y-2 overflow-auto text-xs text-form-caption">{preview.errors.slice(0, 20).map((item, index) => <li key={index} className="break-words">
          <span className="font-medium">{item.source} · {t("Строка {row}", { row: item.row })}: </span>{t(item.message)}
        </li>)}</ul>
        {preview.invalid_count > preview.errors.slice(0, 20).length && <p className="text-xs text-form-caption">{t("Показаны первые ошибки. Всего: {count}.", { count: preview.invalid_count })}</p>}
      </div>}
      {!!preview.warnings?.length && <ul className="space-y-1 text-xs text-form-caption">{preview.warnings.map((warning, index) => <li key={index}>{t(warning)}</li>)}</ul>}
    </section>
  );
}
