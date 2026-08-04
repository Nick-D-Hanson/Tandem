import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isServerActionRequest, mergeRequestCookies } from "@/lib/auth/request-cookies";
import { auth } from "@/lib/auth/server";

const neonAuthProxy = auth.middleware({ loginUrl: "/sign-in" });
const NEON_AUTH_MIDDLEWARE_HEADER = "x-neon-auth-middleware";

export default async function proxy(request: NextRequest) {
  // Server Actions perform their own authorization, and their response stream must
  // pass through unchanged for React to decode it.
  if (isServerActionRequest(request)) return NextResponse.next();

  const response = await neonAuthProxy(request);
  const location = response.headers.get("location");

  if (location) {
    const destination = new URL(location, request.url);
    if (destination.pathname === "/sign-in" && !destination.searchParams.has("redirectTo")) {
      destination.searchParams.set("redirectTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      const redirectResponse = NextResponse.redirect(destination);
      for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
      return redirectResponse;
    }
  }

  const refreshedCookies = response.cookies.getAll();
  if (refreshedCookies.length > 0) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(NEON_AUTH_MIDDLEWARE_HEADER, "true");
    requestHeaders.set(
      "cookie",
      mergeRequestCookies(request.headers.get("cookie"), refreshedCookies),
    );

    const continuedResponse = NextResponse.next({ request: { headers: requestHeaders } });
    for (const cookie of refreshedCookies) continuedResponse.cookies.set(cookie);
    return continuedResponse;
  }

  return response;
}

export const config = {
  matcher: ["/", "/app/:path*", "/settings/:path*", "/onboarding"],
};
