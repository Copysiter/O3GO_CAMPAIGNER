"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ErrorBox } from "./common";

type ScheduleValue = Record<string, number[]>;
type JQueryRuntime = any;
const days = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];
const shortDays = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

function normalized(value: ScheduleValue): ScheduleValue {
  return Object.fromEntries(
    days.map((_, i) => [
      String(i + 1),
      [...new Set(value[String(i + 1)] || [])]
        .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour < 24)
        .sort((a, b) => a - b),
    ]),
  );
}
function script(src: string) {
  return new Promise<void>((resolve, reject) => {
    const element = document.createElement("script");
    element.src = src;
    element.onload = () => resolve();
    element.onerror = () => {
      element.remove();
      reject(new Error("Не удалось загрузить сетку расписания"));
    };
    document.head.append(element);
  });
}
function styles(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}
function loadScheduler(): Promise<JQueryRuntime> {
  const host = window as typeof window & {
    __o3goSchedulerRuntime?: Promise<JQueryRuntime>;
    jQuery?: JQueryRuntime;
  };
  if (!host.__o3goSchedulerRuntime) {
    host.__o3goSchedulerRuntime = (async () => {
      styles("/vendor/scheduler.css");
      styles("/vendor/scheduler-adapter.css");
      await script("/vendor/jquery.min.js");
      const jquery = host.jQuery;
      try {
        await script("/vendor/scheduler.js");
        return jquery.noConflict(true);
      } catch (error) {
        jquery.noConflict(true);
        delete host.__o3goSchedulerRuntime;
        throw error;
      }
    })();
    host.__o3goSchedulerRuntime.catch(() => {
      delete host.__o3goSchedulerRuntime;
    });
  }
  return host.__o3goSchedulerRuntime;
}

/** Owns only the DOM inside its table; all selection logic stays in the original jQuery plugin. */
export function WeeklySchedule({
  value,
  onChange,
  disabled = false,
}: {
  value: ScheduleValue;
  onChange?: (value: ScheduleValue) => void;
  disabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const runtime = useRef<JQueryRuntime>(null);
  const focused = useRef<[number, number]>([1, 0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    setLoading(true);
    setError(null);
    loadScheduler()
      .then(($) => {
        if (disposed || !tableRef.current || !scrollRef.current) return;
        runtime.current = $;
        const table = tableRef.current;
        const scroll = scrollRef.current;
        let restoreFocus = false;
        let lastTouch = 0;
        let pointer: {
          id: number;
          cell: HTMLElement;
        } | null = null;
        const cellAt = (row: number, col: number) =>
          table.querySelector<HTMLElement>(
            `.scheduler-hour[data-row="${row}"][data-col="${col}"]`,
          );
        const getCell = (target: EventTarget | null) =>
          target instanceof Element
            ? target.closest<HTMLElement>(".scheduler-hour")
            : null;
        const accessible = () => {
          table
            .querySelectorAll<HTMLElement>(".scheduler-hour")
            .forEach((cell) => {
              const day = Number(cell.dataset.row),
                hour = Number(cell.dataset.col);
              cell.setAttribute("role", "button");
              cell.setAttribute(
                "aria-label",
                t("{day}, {hour}:00 UTC", {
                  day: t(days[day - 1]),
                  hour: String(hour).padStart(2, "0"),
                }),
              );
              cell.setAttribute(
                "aria-pressed",
                String(cell.classList.contains("scheduler-active")),
              );
              cell.setAttribute("aria-disabled", String(disabled));
              cell.tabIndex =
                !disabled &&
                focused.current[0] === day &&
                focused.current[1] === hour
                  ? 0
                  : -1;
            });
          table
            .querySelectorAll<HTMLElement>(
              ".scheduler-day-toggle,.scheduler-hour-toggle,.scheduler-half-toggle,.scheduler-reset",
            )
            .forEach((cell) => {
              cell.setAttribute("role", "button");
              cell.setAttribute("aria-disabled", String(disabled));
              cell.tabIndex = disabled ? -1 : 0;
              if (cell.dataset.dayToggle)
                cell.setAttribute(
                  "aria-label",
                  t("Весь день: {day}", {
                    day: t(days[Number(cell.dataset.dayToggle) - 1]),
                  }),
                );
              if (cell.dataset.hourToggle)
                cell.setAttribute(
                  "aria-label",
                  t("Вся неделя: {hour}:00 UTC", {
                    hour: cell.dataset.hourToggle,
                  }),
                );
            });
          if (restoreFocus) {
            cellAt(...focused.current)?.focus({ preventScroll: true });
            restoreFocus = false;
          }
        };
        $.fn.scheduler.locales[`o3go-${locale}`] = {
          AM: "AM · 00–11",
          PM: "PM · 12–23",
          TIME_TITLE: "UTC",
          WEEK_TITLE: t("День"),
          WEEK_DAYS: shortDays.map((day) => t(day)),
          DRAG_TIP: t("Перетащите, чтобы выбрать часы"),
          RESET: t("Очистить"),
        };
        $(table).scheduler({
          locale: `o3go-${locale}`,
          accuracy: 1,
          multiple: true,
          disabled,
          footer: !disabled,
          data: normalized(latest.current.value),
          onSelect(data: ScheduleValue) {
            accessible();
            latest.current.onChange?.(normalized(data));
          },
        });
        const instance = $(table).data("scheduler");
        const observer = new MutationObserver(accessible);
        observer.observe(table, { childList: true, subtree: true });
        accessible();
        const onPointerDown = (event: PointerEvent) => {
          if (disabled || event.pointerType === "mouse" || pointer) return;
          lastTouch = Date.now();
          const cell = getCell(event.target);
          if (!cell || !table.contains(cell)) return;
          focused.current = [
            Number(cell.dataset.row),
            Number(cell.dataset.col),
          ];
          pointer = {
            id: event.pointerId,
            cell,
          };
          event.preventDefault();
          scroll.setPointerCapture(event.pointerId);
          instance.onMouseDown({ target: cell });
        };
        const onPointerMove = (event: PointerEvent) => {
          if (!pointer || pointer.id !== event.pointerId) return;
          event.preventDefault();
          const cell = getCell(
            document.elementFromPoint(event.clientX, event.clientY),
          );
          if (cell && table.contains(cell))
            instance.onMouseMove({ target: cell });
        };
        const finishPointer = (event: PointerEvent) => {
          if (!pointer || pointer.id !== event.pointerId) return;
          const active = pointer;
          pointer = null;
          event.preventDefault();
          instance.onMouseUp({ target: active.cell });
          if (scroll.hasPointerCapture(event.pointerId))
            scroll.releasePointerCapture(event.pointerId);
        };
        const suppressMouse = (event: MouseEvent) => {
          if (Date.now() - lastTouch < 800 && getCell(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        };
        const finishMouse = () => {
          if (instance.moving && !pointer) instance.onMouseUp({});
        };
        const keyboard = (event: KeyboardEvent) => {
          const target =
            event.target instanceof HTMLElement ? event.target : null;
          if (!target || disabled || target.getAttribute("role") !== "button")
            return;
          const cell = getCell(target);
          if (!cell) {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              target.click();
            }
            return;
          }
          const row = Number(cell.dataset.row),
            col = Number(cell.dataset.col);
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            focused.current = [row, col];
            restoreFocus = true;
            instance.onMouseDown({ target: cell });
            instance.onMouseUp({ target: cell });
            return;
          }
          let next: [number, number] = [row, col];
          if (event.key === "ArrowRight") next = [row, Math.min(23, col + 1)];
          else if (event.key === "ArrowLeft")
            next = [row, Math.max(0, col - 1)];
          else if (event.key === "ArrowDown")
            next = [Math.min(7, row + 1), col];
          else if (event.key === "ArrowUp") next = [Math.max(1, row - 1), col];
          else if (event.key === "Home") next = [row, 0];
          else if (event.key === "End") next = [row, 23];
          else return;
          event.preventDefault();
          focused.current = next;
          accessible();
          cellAt(...next)?.focus();
        };
        scroll.addEventListener("pointerdown", onPointerDown);
        scroll.addEventListener("pointermove", onPointerMove);
        scroll.addEventListener("pointerup", finishPointer);
        scroll.addEventListener("pointercancel", finishPointer);
        table.addEventListener("mousedown", suppressMouse, true);
        table.addEventListener("mouseup", suppressMouse, true);
        table.addEventListener("keydown", keyboard);
        window.addEventListener("mouseup", finishMouse);
        cleanup = () => {
          observer.disconnect();
          scroll.removeEventListener("pointerdown", onPointerDown);
          scroll.removeEventListener("pointermove", onPointerMove);
          scroll.removeEventListener("pointerup", finishPointer);
          scroll.removeEventListener("pointercancel", finishPointer);
          table.removeEventListener("mousedown", suppressMouse, true);
          table.removeEventListener("mouseup", suppressMouse, true);
          table.removeEventListener("keydown", keyboard);
          window.removeEventListener("mouseup", finishMouse);
          $(table).scheduler("destroy");
          runtime.current = null;
        };
        setLoading(false);
      })
      .catch((reason) => {
        if (!disposed) {
          setError(reason);
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [locale, t, disabled]);

  useEffect(() => {
    const $ = runtime.current;
    if (!$ || !tableRef.current) return;
    const table = $(tableRef.current);
    const next = normalized(value);
    if (
      JSON.stringify(normalized(table.scheduler("val"))) !==
      JSON.stringify(next)
    )
      table.scheduler("val", next);
  }, [value]);

  return (
    <section
      className={`o3go-weekly-scheduler w-full min-w-0 max-w-full space-y-2 ${disabled ? "scheduler-readonly" : ""}`}
      aria-label={t("Недельное расписание отправки")}
    >
      <h3 className="text-sm font-medium">{t("Часы отправки · UTC")}</h3>
      {!disabled && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(
            "Проведите по ячейкам для выбора диапазона. Для прокрутки проводите по заголовкам часов или дней недели.",
          )}
        </p>
      )}
      {loading && (
        <p
          role="status"
          className="flex items-center gap-2 py-2 text-xs text-muted-foreground"
        >
          <LoaderCircle size={14} className="animate-spin" />
          {t("Загрузка расписания…")}
        </p>
      )}
      {error != null && (
        <ErrorBox
          error={error instanceof Error ? new Error(t(error.message)) : error}
        />
      )}
      <div
        ref={scrollRef}
        className="scheduler-scroll"
        tabIndex={0}
        aria-label={t("Сетка расписания: дни и часы")}
      >
        <table ref={tableRef} aria-label={t("Недельное расписание · UTC")} />
      </div>
    </section>
  );
}
