type ResponseCookie = {
  name: string;
  value: string;
};

type RequestLike = {
  method: string;
  headers: Pick<Headers, "has">;
};

export function isServerActionRequest(request: RequestLike) {
  return request.method === "POST" && request.headers.has("next-action");
}

export function mergeRequestCookies(cookieHeader: string | null, updates: ResponseCookie[]) {
  const cookies = new Map<string, string>();

  for (const part of cookieHeader?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;

    const name = part.slice(0, separator).trim();
    if (name) cookies.set(name, part.slice(separator + 1).trim());
  }

  for (const { name, value } of updates) {
    if (value) cookies.set(name, value);
    else cookies.delete(name);
  }

  return Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");
}
