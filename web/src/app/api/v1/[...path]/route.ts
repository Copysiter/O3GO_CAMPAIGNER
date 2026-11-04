// Same-origin transport only. The FastAPI application owns all business rules.
// API_ORIGIN is server configuration, never supplied by a browser request.
export const dynamic = "force-dynamic";

async function proxy(request: Request) {
  const incoming = new URL(request.url);
  const target = new URL(process.env.API_ORIGIN || "http://127.0.0.1:5001");
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  for (const name of ["authorization", "cookie", "content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
    });
    const output = new Headers({ "cache-control": "no-store" });
    for (const name of [
      "content-type",
      "content-disposition",
      "www-authenticate",
      "retry-after",
    ]) {
      const value = upstream.headers.get(name);
      if (value) output.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie())
      output.append("set-cookie", cookie);
    const location = upstream.headers.get("location");
    if (location) {
      const redirect = new URL(location, target);
      output.set(
        "location",
        redirect.origin === target.origin
          ? redirect.pathname + redirect.search + redirect.hash
          : redirect.toString(),
      );
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: output,
    });
  } catch {
    return Response.json(
      {
        detail:
          "API недоступен. Проверьте, что FastAPI запущен и API_ORIGIN настроен верно.",
      },
      { status: 502 },
    );
  }
}

export {
  proxy as GET,
  proxy as HEAD,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};
