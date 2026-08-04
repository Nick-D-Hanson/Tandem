import { describe, expect, it } from "vitest";

import { isCookieMutationRestrictionError, readServerSessionData } from "@/lib/auth/session-reader";

describe("server session handling", () => {
  it("treats a forbidden cookie refresh during rendering as signed out", async () => {
    await expect(readServerSessionData(async () => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    })).resolves.toBeNull();
  });

  it("does not hide unrelated authentication failures", async () => {
    const error = new Error("Auth service unavailable");

    await expect(readServerSessionData(async () => { throw error; })).rejects.toBe(error);
    expect(isCookieMutationRestrictionError(error)).toBe(false);
  });
});
