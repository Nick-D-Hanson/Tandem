import { describe, expect, it } from "vitest";

import { absoluteInviteUrl } from "@/lib/invites";

describe("absoluteInviteUrl", () => {
  it("uses the active production origin", () => {
    expect(absoluteInviteUrl("/invite/token", "https://tandem-planner.vercel.app"))
      .toBe("https://tandem-planner.vercel.app/invite/token");
  });

  it("uses localhost only when the active browser is local", () => {
    expect(absoluteInviteUrl("/invite/token", "http://localhost:3000"))
      .toBe("http://localhost:3000/invite/token");
  });
});
