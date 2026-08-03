import { describe, expect, it } from "vitest";

import { absoluteInviteUrl } from "@/lib/invites";

describe("absoluteInviteUrl", () => {
  it("uses the active production origin", () => {
    expect(absoluteInviteUrl("/invite/token", "https://tandem-n-dw2023s-projects.vercel.app"))
      .toBe("https://tandem-n-dw2023s-projects.vercel.app/invite/token");
  });

  it("uses localhost only when the active browser is local", () => {
    expect(absoluteInviteUrl("/invite/token", "http://localhost:3000"))
      .toBe("http://localhost:3000/invite/token");
  });
});
