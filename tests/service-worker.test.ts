import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Web Push service worker", () => {
  const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

  it("uses a stable replacement tag and never exposes item titles by default", () => {
    expect(source).toContain('tag: "tandem-daily-activity"');
    expect(source).toContain('"Your workspace has new activity."');
    expect(source).not.toContain("entityTitle");
  });

  it("restricts notification destinations to Tandem's own origin", () => {
    expect(source).toContain("target.origin === self.location.origin");
    expect(source).toContain('new URL("/app/my-list?activity=open", self.location.origin)');
  });

  it("focuses an existing app window before opening a new one", () => {
    expect(source).toContain("existing.navigate(url)");
    expect(source).toContain("existing.focus()");
    expect(source).toContain("self.clients.openWindow(url)");
  });
});
