"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { skipToken, useQuery } from "@tanstack/react-query";
import {
  Layers,
  Tags,
  KeyRound,
  Users,
  BookOpen,
  SlidersHorizontal,
  Menu,
  LogOut,
  ArrowUpRight,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { useAuth, usePreferences } from "./providers";
import { useI18n } from "@/lib/i18n";
import { canReadResource, resources } from "@/lib/resources";
import { Settings } from "./settings";
import { ProfileModal } from "./profile";
import { ErrorBox, Loading, Modal } from "./common";
import { api, setSession, type Row, type Session } from "@/lib/api";
const navigation = [
  { key: "campaigns", label: "Кампании", icon: Layers },
  { key: "tags", label: "Теги", icon: Tags },
  { key: "keys", label: "API-ключи", icon: KeyRound },
  { key: "users", label: "Пользователи", icon: Users, admin: true },
  { key: "manual", label: "Руководство", icon: BookOpen },
];
function BrandIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0 text-primary`} fill="currentColor">
      <path d="M13.4 1 3 13.5h8.2L10.6 23 21 10.5h-8.2L13.4 1Z" />
    </svg>
  );
}
function Login({ onSettings }: { onSettings: () => void }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <div className="login-screen grid min-h-dvh place-items-center p-5">
      <div className="login-card panel w-full max-w-md">
        <div className="login-brand flex items-center gap-3 text-primary">
          <BrandIcon className="size-7" />
          <span className="text-lg font-medium">
            Campaigner{" "}
            <span className="font-normal text-muted-foreground">/ o3go</span>
          </span>
        </div>
        <div className="login-body">
          <h1 className="mb-2 text-xl font-medium">{t("С возвращением")}</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {t("Войдите, чтобы управлять кампаниями и доставкой сообщений.")}
          </p>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setPending(true);
              setError(null);
              try {
                setSession(
                  await api<Session>("/auth/access-token", {
                    method: "POST",
                    body: new URLSearchParams({
                      username: String(data.get("login")),
                      password: String(data.get("password")),
                    }),
                  }),
                );
              } catch (err) {
                setError(err);
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="form-field">
              {t("Логин")}
              <Input name="login" autoComplete="username" required />
            </label>
            <label className="form-field">
              {t("Пароль")}
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error != null && <ErrorBox error={error} />}
            <Button className="w-full" disabled={pending}>
              {t(pending ? "Входим…" : "Войти в рабочее пространство")}
              <ArrowUpRight size={16} />
            </Button>
          </form>
        </div>
        <Button
          className="login-appearance mx-auto flex"
          variant="ghost"
          onClick={onSettings}
        >
          <SlidersHorizontal size={16} />
          {t("Внешний вид")}
        </Button>
      </div>
    </div>
  );
}
function Brand({ expanded, close }: { expanded: boolean; close?: () => void }) {
  return (
    <Link
      href="/campaigns"
      aria-label="O3GO Campaigner"
      className="sidebar-brand"
      onClick={close}
    >
      <BrandIcon />
      {expanded && (
        <span className="whitespace-nowrap text-sm font-medium">
          o3go{" "}
          <span className="text-xs font-normal text-muted-foreground">
            / Campaigner
          </span>
        </span>
      )}
    </Link>
  );
}
function CampaignTitle({ id }: { id: number }) {
  // Observe the detail page's existing query without another network request.
  const { data } = useQuery<Row>({ queryKey: ["campaign", id], queryFn: skipToken });
  return <h1 title={data?.name || `#${id}`}>{data?.name || `#${id}`}</h1>;
}
function WorkspaceBreadcrumb({ path }: { path: string }) {
  const { t } = useI18n();
  const key = path.split("/")[1] || "campaigns";
  const detail = path.match(/^\/campaigns\/(\d+)(?:\/|$)/);
  const title =
    resources[key]?.title ||
    (key === "profile" ? "Мой профиль" : key === "manual" ? "Руководство" : "Страница не найдена");
  return (
    <nav
      aria-label={t("Путь раздела")}
      className={`workspace-breadcrumb ${detail ? "has-detail" : ""}`}
    >
      <Link href="/campaigns" className="breadcrumb-home">{t("Workspace")}</Link>
      <span className="breadcrumb-divider breadcrumb-home" aria-hidden="true">/</span>
      {detail ? (
        <>
          <Link href="/campaigns">{t(title)}</Link>
          <span className="breadcrumb-divider" aria-hidden="true">/</span>
          <CampaignTitle id={Number(detail[1])} />
        </>
      ) : (
        <h1 aria-current="page">{t(title)}</h1>
      )}
    </nav>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const { session, ready, logout } = useAuth();
  const { preferences, resolvedTheme, setPreferences } = usePreferences();
  const { t } = useI18n();
  const [settings, setSettings] = useState(false),
    [profile, setProfile] = useState(false),
    [menu, setMenu] = useState(false),
    [confirmLogout, setConfirmLogout] = useState(false),
    [expanded, setExpanded] = useState(false);
  const path = usePathname();
  useEffect(() => {
    setExpanded(localStorage.getItem("campaigner.sidebar.expanded") === "true");
  }, []);
  const toggleExpanded = () =>
    setExpanded((value) => {
      localStorage.setItem("campaigner.sidebar.expanded", String(!value));
      return !value;
    });
  if (!ready) return <Loading />;
  if (!session)
    return (
      <>
        <Login onSettings={() => setSettings(true)} />
        <Settings open={settings} onOpenChange={setSettings} />
      </>
    );
  const nav = (full: boolean) => (
    <nav className="sidebar-nav" aria-label={t("Главное меню")}>
      {navigation
        .filter(
          (item) =>
            (!item.admin || session.user.is_superuser) &&
            (!resources[item.key] ||
              canReadResource(resources[item.key], session.user)),
        )
        .map((item) => {
          const active =
            path === "/"
              ? item.key === "campaigns"
              : path.startsWith("/" + item.key);
          const link = (
            <Link
              href={"/" + item.key}
              onClick={() => setMenu(false)}
              aria-label={t(item.label)}
              aria-current={active ? "page" : undefined}
              className={`nav-link ${active ? "nav-active" : ""}`}
            >
              <item.icon size={18} strokeWidth={1.6} />
              {full && <span>{t(item.label)}</span>}
            </Link>
          );
          return full ? (
            <div key={item.key}>{link}</div>
          ) : (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {t(item.label)}
              </TooltipContent>
            </Tooltip>
          );
        })}
    </nav>
  );
  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={`app-shell ${expanded ? "sidebar-expanded" : "sidebar-collapsed"}`}
      >
        <a className="skip-link" href="#main-content">
          {t("К содержимому")}
        </a>
        <aside className="sidebar">
          <Brand expanded={expanded} />
          {nav(expanded)}
          <div className="sidebar-bottom">
            <div className="sidebar-profile-row">
            <button
              type="button"
              className="sidebar-profile"
              aria-label={t("Профиль")}
              title={session.user.name || session.user.login}
              onClick={() => setProfile(true)}
            >
              <span className="user-avatar">
                <UserRound size={18} />
              </span>
              {expanded && (
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">
                    {session.user.name || session.user.login}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {t(
                      session.user.is_superuser
                        ? "Администратор"
                        : "Пользователь",
                    )}
                  </span>
                </span>
              )}
            </button>
            {expanded && (
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-action sidebar-logout"
              aria-label={t("Выйти")}
              title={t("Выйти")}
              onClick={() => setConfirmLogout(true)}
            >
              <LogOut size={17} />
            </Button>
            )}
            </div>
          </div>
        </aside>
        <div className="workspace">
          <header className="workspace-header">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden"
                aria-label={t("Открыть меню")}
                onPointerDown={(e) => {
                  if (e.pointerType === "touch") {
                    e.preventDefault();
                    setMenu(true);
                  }
                }}
                onClick={() => setMenu(true)}
              >
                <Menu size={20} />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="hidden md:inline-flex"
                aria-label={t(
                  expanded ? "Свернуть сайдбар" : "Развернуть сайдбар",
                )}
                aria-expanded={expanded}
                onClick={toggleExpanded}
              >
                {expanded ? (
                  <PanelLeftClose size={17} />
                ) : (
                  <PanelLeftOpen size={17} />
                )}
              </Button>
              <WorkspaceBreadcrumb path={path} />
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-3 hidden font-mono text-[11px] text-muted-foreground sm:inline">
                UTC
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t(
                  resolvedTheme === "dark"
                    ? "Включить светлую тему"
                    : "Включить тёмную тему",
                )}
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    theme: resolvedTheme === "dark" ? "light" : "dark",
                  })
                }
              >
                {resolvedTheme === "dark" ? (
                  <Sun size={17} />
                ) : (
                  <Moon size={17} />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("Внешний вид")}
                onClick={() => setSettings(true)}
              >
                <SlidersHorizontal size={17} />
              </Button>
            </div>
          </header>
          <main id="main-content" className="page-scroll">
            {children}
          </main>
        </div>
        <Sheet open={menu} onOpenChange={setMenu}>
          <SheetContent
            side="left"
            className="mobile-sidebar flex w-[min(280px,88vw)] flex-col gap-0 p-0"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">{t("Главное меню")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("Навигация по рабочему пространству")}
            </SheetDescription>
            <div className="flex items-center border-b">
              <div className="min-w-0 flex-1">
                <Brand expanded close={() => setMenu(false)} />
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("Закрыть меню")}
                onClick={() => setMenu(false)}
              >
                <PanelLeftClose size={19} />
              </Button>
            </div>
            {nav(true)}
            <div className="mt-auto border-t p-2">
              <div className="sidebar-profile-row">
              <button
                type="button"
                aria-label={t("Профиль")}
                className="sidebar-profile"
                onClick={() => {setMenu(false);setProfile(true);}}
              >
                <span className="user-avatar">
                  <UserRound size={18} />
                </span>
                <span className="truncate text-xs">
                  {session.user.name || session.user.login}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("Выйти")}
                className="sidebar-logout"
                onClick={() => {
                  setMenu(false);
                  setConfirmLogout(true);
                }}
              >
                <LogOut size={17} />
              </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <ProfileModal open={profile} onOpenChange={setProfile} />
        <Settings open={settings} onOpenChange={setSettings} />
        <Modal
          open={confirmLogout}
          onOpenChange={setConfirmLogout}
          title={t("Выйти из аккаунта?")}
          description={t(
            "Локальная сессия будет удалена. Настройки оформления сохранятся.",
          )}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmLogout(false)}>
                {t("Отмена")}
              </Button>
              <Button
                onClick={() => {
                  logout();
                  setConfirmLogout(false);
                }}
              >
                {t("Выйти")}
              </Button>
            </>
          }
        >
          <p>{t("Несохранённые изменения форм будут потеряны.")}</p>
        </Modal>
      </div>
    </TooltipProvider>
  );
}
