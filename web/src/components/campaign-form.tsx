"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Download,
  LoaderCircle,
  UploadCloud,
} from "lucide-react";
import {
  api, downloadGeoLinksReport, type Row, type CampaignImportUpload,
  type CampaignImportMapping, type CampaignImportPreview, type CreatedCampaigns,
} from "@/lib/api";
import { campaignFields, type Field } from "@/lib/resources";
import { canUseField, FieldControl } from "./fields";
import { useAuth } from "./providers";
import { Modal, ErrorBox } from "./common";
import { Button } from "./ui/button";
import { WeeklySchedule as Schedule } from "./weekly-schedule";
import { useI18n } from "@/lib/i18n";
import { CampaignImportFields, CampaignImportSummary, initialImportMappings } from "./campaign-import";

const weekDays = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];
const contactFields = [
  "dst_addr",
  "field_1",
  "field_2",
  "field_3",
  "field_4",
  "field_5",
];
export { WeeklySchedule as Schedule } from "./weekly-schedule";

const aiFields: Field[] = [
  {
    key: "auto_shorten_links",
    label: "Автоматически сокращать ссылки",
    type: "boolean",
    permission: "campaign.auto_shorten_links",
  },
  {
    key: "unique_shorten_link",
    label: "Отдельная короткая ссылка для каждого получателя",
    type: "boolean",
  },
  {
    key: "rewrite",
    label: "AI-рерайт",
    type: "option",
    choices: [
      [0, "Выключен"],
      [1, "Включён"],
    ],
  },
];
const providerField: Field = {
  key: "provider",
  label: "Провайдер",
  type: "option",
  choices: [
    ["openrouter", "OpenRouter"],
    ["ollama", "Ollama"],
  ],
};
const clickerFields: Field[] = [
  { key: "clicker_url", label: "Целевой URL", type: "url" },
  {
    key: "clicker_type",
    label: "Тип кликов",
    type: "option",
    choices: [["mobile", "Мобильные"]],
  },
  { key: "clicker_goal", label: "Количество кликов", type: "number" },
  { key: "clicker_start_ts", label: "Начало (UTC)", type: "date" },
  { key: "clicker_stop_ts", label: "Завершение (UTC)", type: "date" },
  {
    key: "clicker_geo",
    label: "География (ISO2)",
    help: "Двухбуквенный код страны, например RU.",
  },
  {
    key: "clicker_utm_source",
    label: "UTM-источник",
    type: "option",
    choices: [
      ["telegram", "Telegram"],
      ["whatsapp", "WhatsApp"],
      ["instagram", "Instagram"],
      ["facebook", "Facebook"],
      ["messenger", "Messenger"],
      ["viber", "Viber"],
      ["kakao", "Kakao"],
      ["botim", "Botim"],
    ],
  },
  { key: "clicker_split", label: "Распределять клики", type: "boolean" },
];

function textRows(text: string, separator: string, skipRows: number) {
  const rows = text
    .replace(/\r\n/g, "\n")
    .split(separator || "\n")
    .filter((line) => line.trim());
  return rows.slice(Math.max(0, Number(skipRows) || 0));
}

export function CampaignForm({
  row,
  onClose,
  onCreated,
}: {
  row?: Row;
  onClose: () => void;
  onCreated?: (id: number) => void;
}) {
  const { session } = useAuth();
  const { t, locale } = useI18n();
  const client = useQueryClient();
  const panelId = useId();
  const uploadVersion = useRef(0);
  const uploadController = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mappingInitialized = useRef(false);
  useEffect(
    () => () => {
      uploadVersion.current += 1;
      uploadController.current?.abort();
    },
    [],
  );
  const [values, setValues] = useState<Record<string, any>>(() => ({
    ...Object.fromEntries(
      campaignFields.map((f) => [
        f.key,
        f.default ?? (f.type === "multi" ? [] : ""),
      ]),
    ),
    schedule: Object.fromEntries(weekDays.map((_, i) => [String(i + 1), []])),
    status: 0,
    data_text: "",
    data_text_row_sep: "\n",
    data_text_row_skip: 0,
    data_text_col_sep: ";",
    data_fields: {
      dst_addr: 0,
      field_1: null,
      field_2: null,
      field_3: null,
      field_4: null,
      field_5: null,
    },
    rewrite: 0,
    provider: "openrouter",
    auto_shorten_links: false,
    unique_shorten_link: false,
    split_by_geo: false,
    clicker_type: "mobile",
    clicker_split: false,
    ...row,
    tags:
      row?.tags?.map((tag: any) => (typeof tag === "object" ? tag.id : tag)) ||
      [],
    start_ts: String(row?.start_ts || "")
      .replace(" ", "T")
      .replace(/Z$/, ""),
    stop_ts: String(row?.stop_ts || "")
      .replace(" ", "T")
      .replace(/Z$/, ""),
  }));
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<"text" | "file">("text");
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<CampaignImportUpload | null>(null);
  const [importMappings, setImportMappings] = useState<CampaignImportMapping[]>([]);
  const [defaultRegion, setDefaultRegion] = useState("");
  const [excludeInvalid, setExcludeInvalid] = useState(false);
  const [importPreview, setImportPreview] = useState<CampaignImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [completedPreviewKey, setCompletedPreviewKey] = useState("");
  const [created, setCreated] = useState<CreatedCampaigns | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const busy = pending || uploading;
  const importMode = !row && source === "file" && Boolean(uploaded?.import_id);
  const change = (key: string, value: any) =>
    setValues((v) => ({ ...v, [key]: value }));
  const names = row
    ? [t("Основное"), t("Сообщение"), t("Расписание")]
    : [t("Аудитория"), t("Сообщение"), t("Расписание"), "Clicker"];
  const rows = textRows(
    String(values.data_text || ""),
    values.data_text_row_sep,
    values.data_text_row_skip || 0,
  );
  const sample: string[] =
    source === "file"
      ? (uploaded?.sources?.[0]?.sample_rows[importMappings[0]?.skip_rows || 0] || uploaded?.fields || [])
      : (rows[0] || "").split(values.data_text_col_sep || ";");
  const sampleRows =
    source === "file"
      ? sample.length
        ? [sample]
        : []
      : rows
          .slice(0, 3)
          .map((line) => line.split(values.data_text_col_sep || ";"));
  const columnCount =
    source === "file"
      ? sample.length
      : Math.max(1, ...sampleRows.map((items) => items.length));
  const importPreviewKey = importMode ? JSON.stringify({
    import_id: uploaded?.import_id,
    mappings: importMappings,
    default_region: defaultRegion || null,
  }) : "";
  useEffect(() => {
    setImportPreview(null);
    setPreviewError(null);
    setCompletedPreviewKey("");
    if (!importPreviewKey) {
      setPreviewing(false);
      return;
    }
    const controller = new AbortController();
    setPreviewing(true);
    const timer = setTimeout(async () => {
      const { import_id, ...body } = JSON.parse(importPreviewKey);
      try {
        const result = await api<CampaignImportPreview>(`/upload/${import_id}/preview`, {
          method: "POST", body: JSON.stringify(body), signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setImportPreview(result);
          setCompletedPreviewKey(importPreviewKey);
        }
      } catch (error) {
        if (!controller.signal.aborted) setPreviewError(error);
      } finally {
        if (!controller.signal.aborted) setPreviewing(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [importPreviewKey]);
  const importReady = !importMode || Boolean(
    importPreview && !previewing && completedPreviewKey === importPreviewKey &&
    importPreview.valid_count > 0 && (importPreview.invalid_count === 0 || excludeInvalid),
  );

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    const version = ++uploadVersion.current;
    uploadController.current?.abort();
    setFile(selected);
    setUploaded(null);
    setImportMappings([]);
    setExcludeInvalid(false);
    setError(null);
    if (!selected) {
      setUploading(false);
      return;
    }
    if (!/\.(csv|txt|xlsx|xls|zip)$/i.test(selected.name)) {
      setError(new Error(t("Выберите один файл CSV, TXT, XLS, XLSX или ZIP")));
      return;
    }
    setUploading(true);
    const controller = new AbortController();
    uploadController.current = controller;
    try {
      const formData = new FormData();
      formData.append(
        "file",
        selected,
        selected.name.replace(/\.[^.]+$/, (extension) =>
          extension.toLowerCase(),
        ),
      );
      const result = await api("/upload/", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      if (result.type)
        throw new Error(
          result.msg || t("Не удалось прочитать файл получателей"),
        );
      if (
        !result.filename ||
        !Array.isArray(result.fields) ||
        !result.fields.length
      )
        throw new Error(
          t("В файле не найдены колонки. Проверьте содержимое и формат файла."),
        );
      if (version !== uploadVersion.current) return;
      mappingInitialized.current = true;
      const upload = { ...result, fields: result.fields.map(String) } as CampaignImportUpload;
      setUploaded(upload);
      const mappings = initialImportMappings(upload);
      setImportMappings(mappings);
      if (upload.format === "zip" && upload.message != null) change("msg_template", upload.message);
      change(
        "data_fields",
        mappings[0]?.data_fields || Object.fromEntries(
          contactFields.map((key, index) => [
            key,
            index < result.fields.length ? index : null,
          ]),
        ),
      );
    } catch (err) {
      if (version === uploadVersion.current) setError(err);
    } finally {
      if (version === uploadVersion.current) setUploading(false);
    }
  }

  function close() {
    if (pending) return;
    uploadVersion.current += 1;
    uploadController.current?.abort();
    setUploading(false);
    onClose();
  }

  function validateSection(index: number) {
    if (index === 0) {
      if (!String(values.name || "").trim())
        throw new Error(t("Укажите название рассылки"));
      if (values.webhook_url) {
        try {
          const url = new URL(values.webhook_url);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          throw new Error(t("Для webhook укажите полный HTTP(S) URL"));
        }
      }
      if (!row) {
        if (
          source === "text" &&
          (!Number.isInteger(Number(values.data_text_row_skip || 0)) ||
            Number(values.data_text_row_skip || 0) < 0)
        )
          throw new Error(
            t(
              "Количество пропускаемых строк должно быть целым числом не меньше 0",
            ),
          );
        if (source === "text" && !rows.length)
          throw new Error(t("Добавьте хотя бы одного получателя"));
        if (source === "file" && !uploaded)
          throw new Error(t("Выберите файл и дождитесь его загрузки"));
        if (
          source === "text" &&
          (!values.data_text_row_sep || !values.data_text_col_sep)
        )
          throw new Error(t("Укажите разделители строк и колонок"));
      }
    }
    if (index === 1 && !row && !importMode) {
      const phoneColumn = values.data_fields.dst_addr;
      if (
        phoneColumn === null ||
        phoneColumn === undefined ||
        phoneColumn >= columnCount
      )
        throw new Error(t("Выберите колонку с номером телефона"));
      if (
        source === "text" &&
        rows.some(
          (line) => !line.split(values.data_text_col_sep)[phoneColumn]?.trim(),
        )
      )
        throw new Error(
          t(
            "В одной из строк отсутствует телефон. Проверьте сопоставление колонок.",
          ),
        );
    }
    if (index === 1 && importMode) {
      if (importMappings.some((mapping) => mapping.data_fields.dst_addr == null))
        throw new Error(t("Выберите колонку с номером телефона"));
      if (previewError) throw previewError;
      if (previewing || completedPreviewKey !== importPreviewKey || !importPreview)
        throw new Error(t("Дождитесь проверки номеров"));
      if (!importPreview.valid_count)
        throw new Error(t("Нет корректных номеров для создания рассылки"));
      if (importPreview.invalid_count && !excludeInvalid)
        throw new Error(t("Исправьте номера или разрешите пропустить строки с ошибками"));
    }
    if (index === 1 && !row && !String(values.msg_template || "").trim())
      throw new Error(t("Укажите шаблон сообщения"));
    if (index === 1 && values.rewrite && !values.provider)
      throw new Error(t("Выберите провайдера AI-рерайта"));
    if (index === 2) {
      if (
        !Number.isInteger(Number(values.msg_attempts)) ||
        Number(values.msg_attempts) < 1
      )
        throw new Error(
          t("Количество попыток отправки должно быть не меньше 1"),
        );
      for (const key of [
        "order",
        "msg_sending_timeout",
        "msg_status_timeout",
        "follow_limit",
      ]) {
        const value = values[key];
        if (
          value !== null &&
          value !== undefined &&
          value !== "" &&
          (!Number.isInteger(Number(value)) || Number(value) < 0)
        )
          throw new Error(
            t("{field}: укажите целое число не меньше 0", {
              field: t(
                campaignFields.find((field) => field.key === key)?.label || key,
              ),
            }),
          );
      }
      if (
        values.start_ts &&
        values.stop_ts &&
        values.stop_ts <= values.start_ts
      )
        throw new Error(t("Дата завершения должна быть позже даты начала"));
    }
    if (index === 3 && values.clicker_url && !(importMode && values.split_by_geo)) {
      if (
        values.clicker_goal !== undefined &&
        values.clicker_goal !== "" &&
        values.clicker_goal !== null &&
        (!Number.isInteger(Number(values.clicker_goal)) ||
          Number(values.clicker_goal) < 0)
      )
        throw new Error(
          t("Для количества кликов укажите целое число не меньше 0"),
        );
      try {
        const url = new URL(values.clicker_url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        throw new Error(t("Для Clicker укажите полный HTTP(S) URL"));
      }
      if (
        values.clicker_start_ts &&
        values.clicker_stop_ts &&
        values.clicker_stop_ts <= values.clicker_start_ts
      )
        throw new Error(t("Завершение Clicker должно быть позже начала"));
    }
  }

  function next() {
    try {
      validateSection(step);
      if (step === 0 && source === "text" && !mappingInitialized.current) {
        change(
          "data_fields",
          Object.fromEntries(
            contactFields.map((key, index) => [
              key,
              index < columnCount ? index : null,
            ]),
          ),
        );
        mappingInitialized.current = true;
      }
      setError(null);
      setStep((index) => index + 1);
    } catch (err) {
      setError(err);
    }
  }

  async function save() {
    setError(null);
    try {
      for (let index = 0; index < names.length; index++) {
        try {
          validateSection(index);
        } catch (err) {
          setStep(index);
          throw err;
        }
      }
      setPending(true);
      const body: Record<string, any> = {};
      for (const field of campaignFields) {
        if (!canUseField(field, session?.user)) continue;
        body[field.key] = values[field.key] === "" ? null : values[field.key];
      }
      body.schedule = Object.fromEntries(
        weekDays.map((_, index) => [
          String(index + 1),
          values.schedule?.[String(index + 1)] || [],
        ]),
      );
      if (!row) {
        body.status = 0;
        if (source === "text") {
          body.data_text = rows.join(values.data_text_row_sep);
          body.data_text_row_sep = values.data_text_row_sep;
          body.data_text_col_sep = values.data_text_col_sep;
        } else if (importMode) {
          body.import_id = uploaded!.import_id;
          body.mappings = importMappings;
          body.default_region = defaultRegion || null;
          body.exclude_invalid = excludeInvalid;
          body.split_by_geo = Boolean(values.split_by_geo);
        } else {
          body.data_file_name = uploaded!.filename;
        }
        body.data_fields = Object.fromEntries(
          contactFields.map((key) => {
            const index = values.data_fields[key];
            return [
              key,
              typeof index === "number" && index < columnCount ? index : null,
            ];
          }),
        );
        body.data_text_row_skip = 0;
        for (const field of aiFields) {
          if (
            canUseField(field, session?.user) &&
            values[field.key] !== undefined
          )
            body[field.key] = values[field.key];
        }
        body.check_dst = Boolean(values.check_dst);
        if (values.rewrite) {
          body.provider = values.provider;
          body.prompt = values.prompt || null;
          if (
            values.provider !== "openrouter" ||
            canUseField(
              {
                key: "model",
                label: t("Модель"),
                permission: "campaign.openrouter.model",
              },
              session?.user,
            )
          )
            body.model = values.model || null;
        }
        if (values.clicker_url && !(importMode && values.split_by_geo)) {
          for (const field of clickerFields)
            if (values[field.key] !== undefined && values[field.key] !== "")
              body[field.key] = values[field.key];
        }
      }
      const result = await api(importMode ? "/campaigns/from-import" : `/campaigns/${row ? row.id : ""}`, {
        method: row ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["rows"] }),
        client.invalidateQueries({ queryKey: ["campaign"] }),
        client.invalidateQueries({ queryKey: ["campaign-count"] }),
      ]);
      toast.success(
        row
          ? t("Рассылка обновлена")
          : importMode
            ? t("Создано рассылок: {count}", { count: result.created_count })
          : t("Рассылка создана. Запустите её, когда будете готовы."),
      );
      if (importMode) {
        setCreated(result as CreatedCampaigns);
      } else {
        onClose();
        if (!row) onCreated?.(result.id);
      }
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  let preview = String(values.msg_template || "");
  if (!row) {
    for (let index = 1; index <= 5; index++) {
      const column = values.data_fields?.[`field_${index}`];
      const replacement =
        typeof column === "number" ? sample[column] : undefined;
      if (replacement !== undefined)
        preview = preview.replaceAll(`{field_${index}}`, replacement);
    }
  }

  const divider = (separator: string) => (
    <div
      role="separator"
      className="form-divider campaign-form-divider"
      data-separator={separator}
    />
  );
  type FormItem = [string | Field, (4 | 6 | 12)?, boolean?];
  const controls = (items: FormItem[], onChange = change) => (
    <div className="campaign-form-group form-flow">
      {items.map(([item, span = 6, disabled = false]) => {
        const field =
          typeof item === "string"
            ? campaignFields.find((field) => field.key === item)
            : item;
        if (!field || !canUseField(field, session?.user)) return null;
        return (
          <fieldset
            key={field.key}
            disabled={disabled}
            className={`min-w-0 border-0 p-0 ${span === 12 ? "form-full" : span === 4 ? "form-third" : ""}`}
          >
            <FieldControl
              field={
                field.type === "boolean" ? { ...field, inline: true } : field
              }
              value={values[field.key]}
              onChange={(value) => onChange(field.key, value)}
              editing={!!row}
            />
          </fieldset>
        );
      })}
    </div>
  );
  const identity = session?.user.is_superuser ? (
    <>
      {controls([["name", 12]])}
      {divider(row ? "sep1" : "sep0")}
      {controls([
        ["user_id", 6],
        ["webhook_url", 6],
      ])}
    </>
  ) : (
    controls([
      ["name", 6],
      ["webhook_url", 6],
    ])
  );
  const hasAssignments = ["api_keys", "androids", "tags"].some((key) =>
    canUseField(
      campaignFields.find((field) => field.key === key)!,
      session?.user,
    ),
  );
  const assignments = controls([
    ["api_keys", 4],
    ["androids", 4],
    ["tags", 4],
  ]);
  const timing = (
    <>
      {divider(row ? "sep7" : "sep16")}
      {controls([
        ["msg_sending_timeout", 6],
        ["msg_status_timeout", 6],
      ])}
      {divider(row ? "sep8" : "sep17")}
      {controls([
        ["start_ts", 6],
        ["stop_ts", 6],
      ])}
      {divider(row ? "sep9" : "sep18-schedule")}
      <Schedule
        value={values.schedule || {}}
        onChange={(value) => change("schedule", value)}
      />
    </>
  );
  const mapping = (
    <>
      {divider("sep7")}
      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t("Сопоставление колонок")}</h3>
          <Button
            type="button"
            variant="ghost"
            disabled={source === "file" && !uploaded}
            onClick={() =>
              change(
                "data_fields",
                Object.fromEntries(
                  contactFields.map((key, index) => [
                    key,
                    index < columnCount ? index : null,
                  ]),
                ),
              )
            }
          >
            {t("По порядку")}
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-form-caption">
          {t(
            "Выберите колонку телефона и поля для подстановки в сообщение. Нумерация начинается с 1.",
          )}
        </p>
        <div className="form-flow form-flow-thirds">
          {contactFields.map((key, index) => (
            <label key={key} className="form-field min-w-0">
              <span>
                {index === 0
                  ? t("Телефон *")
                  : t("Поле {index} · {field}", {
                      index,
                      field: `{field_${index}}`,
                    })}
              </span>
              <select
                aria-label={
                  index === 0
                    ? t("Колонка телефона")
                    : t("Колонка поля {index}", { index })
                }
                className="native-select w-full min-w-0"
                disabled={source === "file" && !uploaded}
                value={values.data_fields[key] ?? ""}
                onChange={(event) =>
                  change("data_fields", {
                    ...values.data_fields,
                    [key]:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
              >
                <option value="">
                  {index === 0 ? t("Выберите колонку") : t("Не использовать")}
                </option>
                {Array.from({ length: columnCount }, (_, column) => (
                  <option key={column} value={column}>
                    {t("Колонка {index}", { index: column + 1 })}
                    {sample[column] ? ` · ${sample[column].slice(0, 40)}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>
      {sampleRows.length > 0 && (
        <section className="min-w-0 max-w-full space-y-2">
          <h3 className="text-xs font-medium text-form-caption">
            {source === "file"
              ? t("Образец из файла")
              : t("Первые строки после обработки")}
          </h3>
          <div
            className="form-table-scroll w-full min-w-0 max-w-full overflow-x-auto border"
            tabIndex={0}
            aria-label={t("Предпросмотр колонок получателей")}
          >
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary">
                <tr>
                  {Array.from({ length: columnCount }, (_, column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap border-r px-3 py-2 font-medium"
                    >
                      {t("Колонка {index}", { index: column + 1 })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((items, index) => (
                  <tr key={index} className="border-t">
                    {Array.from({ length: columnCount }, (_, column) => (
                      <td key={column} className="max-w-56 border-r px-3 py-2">
                        <span className="line-clamp-2 break-words">
                          {items[column] || "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
  const template = (
    <>
      {controls([["msg_template", 12]])}
      {!row && (
        <div className="campaign-preview min-w-0 border p-3">
          <div className="mb-2 text-xs font-medium text-form-caption">
            {source === "file"
              ? t("Предпросмотр по образцу из файла")
              : t("Предпросмотр первого получателя")}
          </div>
          <p className="break-words whitespace-pre-wrap text-sm leading-relaxed">
            {preview || t("Текст сообщения появится здесь")}
          </p>
          <p className="mt-2 text-xs text-form-caption">
            {t(
              "Символов: {count}. Сокращение ссылок и AI-рерайт выполняются после создания.",
              { count: preview.length },
            )}
          </p>
        </div>
      )}
    </>
  );

  const importSummary = importMode ? (
    <CampaignImportSummary
      preview={importPreview}
      loading={previewing || completedPreviewKey !== importPreviewKey}
      error={previewError}
      split={Boolean(values.split_by_geo)}
      name={values.name}
      excludeInvalid={excludeInvalid}
      onExcludeInvalidChange={setExcludeInvalid}
    />
  ) : null;

  if (created) {
    return (
      <Modal className="form-surface"
        open
        title={t("Рассылки созданы")}
        description={t("Все рассылки созданы без запуска. Скачайте общую сводку по ссылкам этой загрузки.")}
        onOpenChange={(open) => !open && onClose()}
        bodyClassName="min-w-0 overflow-x-hidden"
        footer={<Button variant="outline" onClick={onClose}>{t("Перейти к рассылкам")}</Button>}
      >
        <div className="min-w-0 space-y-4">
          <p className="text-sm font-medium">{t("Создано рассылок: {count}", { count: created.created_count })}</p>
          <ul className="form-summary-list divide-y border-y">
            {created.campaigns.map((campaign) => (
              <li key={campaign.id} className="flex min-w-0 items-start justify-between gap-3 py-3 text-sm">
                <Link href={`/campaigns/${campaign.id}`} onClick={onClose} className="min-w-0 break-words text-primary underline-offset-4 hover:underline">
                  {campaign.name}
                </Link>
                <span className="shrink-0 tabular-nums">{campaign.msg_total.toLocaleString(locale)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-form-caption">{t("Один Excel для всех созданных рассылок: страна, исходная ссылка и количество уникальных номеров.")}</p>
          {error != null && <ErrorBox error={error} />}
          <Button className="h-auto min-h-10 max-w-full whitespace-normal text-left" disabled={downloading} onClick={async () => {
            setDownloading(true);
            setError(null);
            try { await downloadGeoLinksReport(created.import_id); }
            catch (error) { setError(error); }
            finally { setDownloading(false); }
          }}>
            {downloading ? <LoaderCircle size={16} className="shrink-0 animate-spin" /> : <Download size={16} className="shrink-0" />}
            {t("Ссылки по GEO — Excel")}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal className="form-surface"
      open
      onOpenChange={(open) => !open && close()}
      bodyClassName="campaign-form-body min-w-0 overflow-x-hidden"
      title={
        row
          ? t("Настройки рассылки #{id}", { id: row.id })
          : t("Новая рассылка")
      }
      description={
        row
          ? t("Настройки отправки, шаблон сообщения и расписание.")
          : t(
              "Подготовьте аудиторию и сообщение. Запустить рассылку можно после создания.",
            )
      }
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={pending}>
            {t("Отмена")}
          </Button>
          {!row && step > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setStep((index) => index - 1);
              }}
              disabled={busy}
            >
              <ChevronLeft size={16} />
              {t("Назад")}
            </Button>
          )}
          {!row && step < names.length - 1 ? (
            <Button onClick={next} disabled={busy}>
              {t("Далее")}
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button disabled={busy || !importReady} onClick={save}>
              {pending ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              {pending
                ? t("Сохранение…")
                : row
                  ? t("Сохранить")
                  : importMode && values.split_by_geo && importPreview
                    ? t("Создать {count}", { count: importPreview.geo_groups.length })
                  : t("Создать")}
            </Button>
          )}
        </>
      }
    >
      <div className="campaign-form form-sections w-full max-w-full">
        {!row && (
          <div
            className="grid min-w-0 grid-cols-2 gap-2 min-[360px]:grid-cols-4"
            role="tablist"
            aria-label={t("Шаги рассылки")}
          >
            {names.map((name, index) => (
              <button
                key={name}
                id={`${panelId}-tab-${index}`}
                type="button"
                role="tab"
                aria-controls={`${panelId}-panel`}
                aria-selected={step === index}
                disabled={busy}
                className={`campaign-wizard-step min-h-14 min-w-0 touch-manipulation rounded-sm border px-1 py-2 text-[11px] transition-colors ${step === index ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground dark:border-white/15 hover:bg-secondary"}`}
                onClick={() => {
                  setError(null);
                  setStep(index);
                }}
              >
                <span className="mb-1 block text-sm font-semibold">
                  {index + 1}
                </span>
                {name}
              </button>
            ))}
          </div>
        )}
        {error != null && (
          <ErrorBox error={error} />
        )}
        <div
          id={`${panelId}-panel`}
          role={row ? undefined : "tabpanel"}
          aria-labelledby={row ? undefined : `${panelId}-tab-${step}`}
          className="form-sections max-w-full"
        >
          {row ? (
            <>
              {identity}
              {divider("sep2")}
              {controls([
                ["order", 4],
                ["msg_attempts", 4],
                ["follow_limit", 4],
              ])}
              {divider("sep3")}
              {template}
              {hasAssignments && (
                <>
                  {divider("sep4")}
                  {assignments}
                </>
              )}
              {timing}
            </>
          ) : (
            <>
              {step === 0 && (
                <>
                  {divider("sep2")}
                  {identity}
                  {hasAssignments && (
                    <>
                      {divider("sep1")}
                      {assignments}
                    </>
                  )}
                  {divider("sep3")}
                  <div className="campaign-form-group form-flow">
                    <label className="form-field min-w-0">
                      <span>{t("Источник данных")}</span>
                      <select
                        aria-label={t("Источник данных")}
                        className="native-select w-full"
                        value={source}
                        disabled={uploading}
                        onChange={(event) => {
                          setSource(event.target.value as "text" | "file");
                          mappingInitialized.current = false;
                          setError(null);
                        }}
                      >
                        <option value="text">{t("Вставить текст")}</option>
                        <option value="file">CSV / TXT / Excel / ZIP</option>
                      </select>
                    </label>
                    <fieldset
                      disabled={source === "file"}
                      className="min-w-0 border-0 p-0"
                    >
                      <FieldControl
                        field={{
                          key: "data_text_row_skip",
                          label: t("Пропустить строк"),
                          type: "number",
                          min: 0,
                        }}
                        value={values.data_text_row_skip || 0}
                        onChange={(value) =>
                          change("data_text_row_skip", value)
                        }
                      />
                    </fieldset>
                  </div>
                  {divider("sep4")}
                  {source === "text" ? (
                    <>
                      {controls([
                        [
                          {
                            key: "data_text_row_sep",
                            label: t("Разделитель строк"),
                            type: "option",
                            choices: [
                              ["\n", t("Новая строка")],
                              [" ", t("Пробел")],
                              [".", t("Точка")],
                              [":", t("Двоеточие")],
                              [";", t("Точка с запятой")],
                              [",", t("Запятая")],
                              ["|", t("Вертикальная черта")],
                            ],
                          },
                          6,
                        ],
                        [
                          {
                            key: "data_text_col_sep",
                            label: t("Разделитель колонок"),
                            type: "option",
                            choices: [
                              [" ", t("Пробел")],
                              [".", t("Точка")],
                              [":", t("Двоеточие")],
                              [";", t("Точка с запятой")],
                              [",", t("Запятая")],
                              ["|", t("Вертикальная черта")],
                            ],
                          },
                          6,
                        ],
                        [
                          {
                            key: "data_text",
                            label: t("Данные получателей"),
                            type: "textarea",
                            help: t(
                              "Один получатель на строку: телефон;поле 1;поле 2…",
                            ),
                          },
                          12,
                        ],
                      ])}
                      <p className="text-xs text-form-caption">
                        {t(
                          "Получателей: {count}. Пустые строки пропускаются.",
                          { count: rows.length.toLocaleString(locale) },
                        )}
                      </p>
                    </>
                  ) : (
                    <div className="field-group-surface min-w-0 space-y-3 border border-dashed p-3">
                      <input
                        ref={fileInputRef}
                        className="sr-only"
                        aria-label={t("Файл получателей")}
                        type="file"
                        accept=".csv,.txt,.xlsx,.xls,.zip"
                        disabled={uploading}
                        onChange={selectFile}
                      />
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploading}
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                              fileInputRef.current.click();
                            }
                          }}
                        >
                          <UploadCloud size={15} />
                          {t("Выбрать файл")}
                        </Button>
                        <span className="min-w-0 break-all text-xs text-form-caption">
                          {file?.name || t("Файл не выбран")}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-form-caption">
                        {t(
                          "Один файл: CSV, TXT, XLS, XLSX или ZIP. В ZIP — text.txt с общим сообщением и остальные TXT с одним телефоном на строке.",
                        )}
                      </p>
                      <div
                        aria-live="polite"
                        className="flex min-w-0 items-center gap-2 text-xs"
                      >
                        {uploading && (
                          <>
                            <LoaderCircle
                              size={14}
                              className="shrink-0 animate-spin"
                            />
                            {t("Загрузка и чтение колонок…")}
                          </>
                        )}
                        {uploaded && (
                          <>
                            <FileCheck2
                              size={14}
                              className="shrink-0 text-primary"
                            />
                            <span className="min-w-0 break-all">
                              {uploaded.import_id ? t("{name} · {count} строк", {
                                name: file?.name || "",
                                count: uploaded.total_rows || 0,
                              }) : t("{name} · {count} колонок", {
                                name: file?.name || "",
                                count: uploaded.fields.length,
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {divider("sep5")}
                  {controls([
                    [
                      {
                        key: "check_dst",
                        label: t("Проверить номера получателей"),
                        type: "boolean",
                        help: t("Проверка выполняется в фоне."),
                      },
                      12,
                    ],
                  ])}
                </>
              )}
              {step === 1 && (
                <>
                  {importMode && uploaded ? <>
                    {divider("sep7")}
                    <CampaignImportFields
                      upload={uploaded}
                      mappings={importMappings}
                      onChange={(mappings) => {
                        setImportMappings(mappings);
                        setExcludeInvalid(false);
                        if (mappings[0]) change("data_fields", mappings[0].data_fields);
                      }}
                      defaultRegion={defaultRegion}
                      onDefaultRegionChange={(region) => {
                        setDefaultRegion(region);
                        setExcludeInvalid(false);
                      }}
                    />
                  </> : mapping}
                  {divider("sep8")}
                  {template}
                  {importMode && <>
                    {divider("sep8-geo")}
                    {controls([[{
                      key: "split_by_geo",
                      label: t("Разделить по GEO"),
                      type: "boolean",
                    }, 12]])}
                    <p className="text-xs leading-relaxed text-form-caption">{t("Для каждой страны будет создана отдельная рассылка с префиксом [ru], [kz] и т. д.")}</p>
                    {importSummary}
                  </>}
                  {canUseField(aiFields[0], session?.user) && (
                    <>
                      {divider("sep9")}
                      {controls([[aiFields[0], 12]])}
                    </>
                  )}
                  {divider("sep10")}
                  {controls([[aiFields[1], 12]])}
                  {divider("sep12")}
                  {controls(
                    [
                      [aiFields[2], 4],
                      [providerField, 4, !values.rewrite],
                      [
                        {
                          key: "model",
                          label: t("Модель AI"),
                          type:
                            values.provider === "openrouter"
                              ? "option"
                              : "text",
                          options:
                            values.provider === "openrouter"
                              ? "openrouter/models"
                              : undefined,
                          permission:
                            values.provider === "openrouter"
                              ? "campaign.openrouter.model"
                              : undefined,
                        },
                        4,
                        !values.rewrite,
                      ],
                      [
                        {
                          key: "prompt",
                          label: t("Системный промпт"),
                          type: "textarea",
                          help: t(
                            "Оставьте пустым, чтобы использовать системный промпт сервера.",
                          ),
                        },
                        12,
                        !values.rewrite,
                      ],
                    ],
                    (key, value) => {
                      if (key === "provider") change("model", null);
                      change(key, value);
                    },
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  {divider("sep15")}
                  {controls([
                    ["order", 4],
                    ["msg_attempts", 4],
                    ["follow_limit", 4],
                  ])}
                  {timing}
                </>
              )}
              {step === 3 && (
                <>
                  {divider("sep19")}
                  {importMode && values.split_by_geo && <p className="text-sm leading-relaxed text-form-caption">{t("Clicker доступен при создании одной рассылки без разделения по GEO.")}</p>}
                  <fieldset disabled={Boolean(importMode && values.split_by_geo)} className="form-sections border-0 p-0 disabled:opacity-50">
                  {controls([
                    [clickerFields[0], 12],
                    [clickerFields[1], 6],
                    [clickerFields[2], 6],
                    [clickerFields[6], 6],
                    [clickerFields[5], 6],
                    [clickerFields[3], 6],
                    [clickerFields[4], 6],
                  ])}
                  {divider("sep20")}
                  {controls([[clickerFields[7], 12]])}
                  </fieldset>
                  {divider("sep21")}
                  {importMode ? importSummary : <div className="campaign-preview min-w-0 border p-3">
                    <h3 className="mb-2 text-sm font-medium">
                      {t("Готово к созданию")}
                    </h3>
                    <p className="break-words text-sm">
                      {values.name || t("Без названия")}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-form-caption">
                      {source === "file"
                        ? t("Аудитория: {name}", {
                            name: file?.name || t("файл не выбран"),
                          })
                        : t("Получателей: {count}", {
                            count: rows.length.toLocaleString(locale),
                          })}{" "}
                      ·{" "}
                      {values.rewrite
                        ? t("AI-рерайт включён")
                        : t("Исходный текст")}{" "}
                      {t("· Создаётся в статусе «Создана»")}
                    </p>
                  </div>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
