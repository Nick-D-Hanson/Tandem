import { describe, expect, it } from "vitest";

import { isServerActionRequest, mergeRequestCookies } from "@/lib/auth/request-cookies";

describe("proxy cookie handoff", () => {
  it("recognizes Server Action requests that must pass through unchanged", () => {
    expect(isServerActionRequest({
      method: "POST",
      headers: new Headers({ "Next-Action": "action-id" }),
    })).toBe(true);
    expect(isServerActionRequest({
      method: "GET",
      headers: new Headers({ "Next-Action": "action-id" }),
    })).toBe(false);
  });

  it("passes a refreshed session cookie to the same server render", () => {
    expect(
      mergeRequestCookies("theme=dark; neon-auth.session_data=stale", [
        { name: "neon-auth.session_data", value: "fresh" },
      ]),
    ).toBe("theme=dark; neon-auth.session_data=fresh");
  });

  it("removes cleared cookies without disturbing unrelated cookies", () => {
    expect(
      mergeRequestCookies("theme=dark; neon-auth.session_data=stale", [
        { name: "neon-auth.session_data", value: "" },
      ]),
    ).toBe("theme=dark");
  });

  it("preserves equals signs in cookie values", () => {
    expect(mergeRequestCookies("encoded=a=b=c", [])).toBe("encoded=a=b=c");
  });
});
