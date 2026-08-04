import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";

const neonAuthProxy = auth.middleware({ loginUrl: "/sign-in" });

export default async function proxy(request: NextRequest) {
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

  return response;
}

export const config = {
  matcher: ["/", "/app/:path*", "/settings/:path*", "/onboarding"],
};
