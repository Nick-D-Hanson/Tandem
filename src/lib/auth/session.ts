import { auth } from "@/lib/auth/server";
import { readServerSessionData } from "@/lib/auth/session-reader";

export function getServerSessionData() {
  return readServerSessionData(() => auth.getSession());
}
