"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Settings2,
  Play,
  Pause,
  Ellipsis,
  Download,
  RefreshCw,
} from "lucide-react";
import { api, type Row } from "@/lib/api";
import {
  resources,
  messageResource,
  campaignStatuses,
  hasPermission,
  canReadResource,
} from "@/lib/resources";
import { useI18n } from "@/lib/i18n";
import { DataTable } from "./data-table";
import { getResourceActions, useResourceActions } from "./resource-page";
import { useAuth } from "./providers";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ErrorBox, Loading, Value } from "./common";

export function CampaignDetail({ id }: { id: number }) {
  const { session } = useAuth();
  const { t, locale } = useI18n();
  const readable = canReadResource(resources.campaigns, session?.user);
  const actions = getResourceActions(resources.campaigns, session?.user);
  const canManage = hasPermission(session?.user, "campaign.manage");
  const canStartStop = hasPermission(session?.user, "campaign.start_stop");
  const query = useQuery<Row>({
    queryKey: ["campaign", id],
    queryFn: ({ signal }) => api(`/campaigns/${id}`, { signal }),
    refetchInterval: 60000,
    enabled: readable,
  });
  const campaign = useResourceActions(resources.campaigns);
  const messages = useResourceActions(messageResource(id));
  if (!readable)
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t("Недостаточно прав для просмотра кампаний.")}
      </div>
    );
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <div className="p-4">
        <ErrorBox error={query.error} retry={() => query.refetch()} />
      </div>
    );
  const row = query.data!;
  return (
    <div className="resource-page campaign-detail-page">
      <div className="resource-body campaign-detail-body">
        <div
          className="campaign-header-stack flex min-w-0 shrink-0 flex-col gap-2"
          role="region"
          aria-label={t("Сводка кампании")}
        >
          <div className="campaign-actions flex min-w-0 shrink-0 items-center justify-between gap-2 border-b bg-card p-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <Button
                variant="outline"
                size="icon"
                className="campaign-toolbar-control"
                asChild
              >
                <Link
                  href="/campaigns"
                  aria-label={t("Все кампании")}
                  title={t("Все кампании")}
                >
                  <ArrowLeft size={15} />
                </Link>
              </Button>
              <span className="campaign-toolbar-status min-w-0 shrink-0 [&_.status-badge]:h-full">
                <Value value={row.status} choices={campaignStatuses} />
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="campaign-toolbar-control hidden md:inline-flex"
                  onClick={() => campaign.onAction("edit", [row])}
                >
                  <Settings2 size={14} />
                  <span>{t("Настройки")}</span>
                </Button>
              )}
              {canStartStop && (
                <Button
                  size="sm"
                  className="campaign-toolbar-control"
                  aria-label={t(row.status === 1 ? "Пауза" : "Запустить")}
                  onClick={() =>
                    campaign.onAction(row.status === 1 ? "pause" : "start", [
                      row,
                    ])
                  }
                >
                  {row.status === 1 ? <Pause size={14} /> : <Play size={14} />}
                  <span className="hidden min-[360px]:inline">
                    {t(row.status === 1 ? "Пауза" : "Запустить")}
                  </span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="campaign-toolbar-control hidden md:inline-flex"
                aria-label={t("Обновить статистику кампании")}
                disabled={query.isFetching}
                onClick={() => query.refetch()}
              >
                <RefreshCw
                  size={14}
                  className={query.isFetching ? "animate-spin" : ""}
                />
                {t("Обновить")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="campaign-toolbar-control hidden lg:inline-flex"
                onClick={() => campaign.onAction("export", [row])}
              >
                <Download size={14} />
                {t("Отчёт Excel")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="campaign-toolbar-control"
                    aria-label={t("Все действия кампании")}
                  >
                    <Ellipsis size={17} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="max-h-[75dvh] w-64 overflow-auto"
                >
                  <DropdownMenuItem
                    disabled={query.isFetching}
                    onSelect={() => query.refetch()}
                  >
                    <RefreshCw
                      size={14}
                      className={query.isFetching ? "animate-spin" : ""}
                    />
                    {t("Обновить")}
                  </DropdownMenuItem>
                  {actions.map((action) => (
                    <DropdownMenuItem
                      key={action.key}
                      className={action.danger ? "text-destructive" : ""}
                      disabled={
                        action.key === "retry" && !Number(row.msg_undelivered)
                      }
                      onSelect={() => campaign.onAction(action.key, [row])}
                    >
                      {t(action.label)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="resource-stats campaign-statistics shrink-0">
            {[
              { key: "msg_total", label: "Всего", tone: "info" },
              { key: "msg_sent", label: "Отправлено", tone: "info" },
              { key: "link_clicks", label: "Клики", tone: "info" },
              { key: "msg_delivered", label: "Доставлено", tone: "success" },
              {
                key: "msg_undelivered",
                label: "Не доставлено",
                tone: "warning",
              },
              { key: "msg_failed", label: "Ошибки", tone: "error" },
            ].map((stat) => {
              const percentage =
                stat.key === "msg_total"
                  ? 100
                  : Math.max(
                      0,
                      Math.min(
                        100,
                        row.msg_total
                          ? ((row[stat.key] || 0) / row.msg_total) * 100
                          : 0,
                      ),
                    );
              return (
                <div
                  key={stat.key}
                  data-stat-key={stat.key}
                  className="resource-stat campaign-stat"
                >
                  <div className="resource-stat-label" title={t(stat.label)}>
                    <span className="truncate">{t(stat.label)}</span>
                  </div>
                  <div
                    className="resource-stat-value"
                    style={{ color: `var(--${stat.tone})` }}
                  >
                    {Number(row[stat.key] || 0).toLocaleString(locale)}
                  </div>
                  <div
                    className="campaign-stat-progress h-0.5 w-full shrink-0 bg-secondary"
                    role="progressbar"
                    aria-label={t(stat.label)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentage}
                  >
                    <div
                      className="h-0.5"
                      style={{
                        background: `var(--${stat.tone})`,
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DataTable
          key={id}
          resource={messageResource(id)}
          actions={
            canManage
              ? [{ key: "delete", label: t("Удалить сообщение"), danger: true }]
              : []
          }
          bulkActions={
            canManage
              ? [{ key: "delete", label: t("Удалить выбранные"), danger: true }]
              : []
          }
          onAction={messages.onAction}
        />
      </div>
      {campaign.dialogs}
      {messages.dialogs}
    </div>
  );
}
