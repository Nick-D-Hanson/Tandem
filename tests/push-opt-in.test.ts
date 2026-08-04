import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Web Push opt-in interaction", () => {
  const source = readFileSync(new URL("../src/components/activity/push-opt-in.tsx", import.meta.url), "utf8");

  it("never requests notification permission during support inspection", () => {
    const beforeEnableHandler = source.slice(0, source.indexOf("function enable()"));
    expect(beforeEnableHandler).not.toContain("requestPermission");
  });

  it("requests permission only inside the explicit enable handler", () => {
    const enableHandler = source.slice(source.indexOf("function enable()"), source.indexOf("function disable()"));
    expect(enableHandler).toContain("Notification.requestPermission()");
  });
});
