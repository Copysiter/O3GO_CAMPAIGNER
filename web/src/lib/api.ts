import { currentText } from "./i18n";
export type Row = Record<string, any> & { id: number };
export type PageData = { data: Row[]; total: number };
export type User = {
  id: number;
  name: string;
  login: string;
  is_superuser: boolean;
  is_active: boolean;
  permissions: string[];
  ext_api_key?: string;
  api_keys?: string[];
};
export type Session = {
  access_token: string;
  token_type: string;
  user: User;
  ts: string;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const KEY = "campaigner.workspace.session";
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return value?.access_token && value?.user ? value : null;
  } catch {
    return null;
  }
}
export function setSession(value: Session | null) {
  if (value) localStorage.setItem(KEY, JSON.stringify(value));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("session-change"));
}
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
  raw = false,
): Promise<T> {
  const session = getSession();
  const headers = new Headers(init.headers);
  if (session)
    headers.set(
      "Authorization",
      `${session.token_type} ${session.access_token}`,
    );
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams)
  )
    headers.set("Content-Type", "application/json");
  const origin = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${origin}/api/v1${path}`, {
      ...init,
      headers,
      credentials: origin ? "include" : "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      currentText(
        "Нет соединения с API. Проверьте подключение и адрес сервера.",
      ),
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({
      detail:
        response.status >= 500
          ? currentText(
              "API недоступен. Проверьте, что FastAPI запущен и API_ORIGIN настроен верно.",
            )
          : response.statusText,
    }));
    if (
      response.status === 401 ||
      (response.status === 403 &&
        /Could not validate credentials|Not authenticated/i.test(
          body.detail || "",
        ))
    )
      setSession(null);
    const message = Array.isArray(body.detail)
      ? body.detail
          .map((d: any) => `${d.loc?.slice(1).join(".")}: ${d.msg}`)
          .join("; ")
      : body.detail || body.msg || response.statusText;
    throw new ApiError(
      response.status,
      typeof message === "string" ? message : JSON.stringify(message),
    );
  }
  if (raw) return response as T;
  if (response.status === 204) return undefined as T;
  return response.json();
}
export async function downloadReport(id: number) {
  const response = await api<Response>(`/campaigns/${id}/report`, {}, true);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaign-${id}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function uploadFile(path: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  const result = await api(path, { method: "POST", body });
  if (result.type || (!result.filename && !result.file_name))
    throw new Error(result.msg || currentText("Не удалось загрузить файл"));
  return result;
}
