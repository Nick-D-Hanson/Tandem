import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Item editor validation", () => {
  const editor = readFileSync(new URL("../src/components/item-editor/item-editor.tsx", import.meta.url), "utf8");

  it("preserves form values when a server validation error is returned", () => {
    expect(editor).toContain("event.preventDefault(); submit(new FormData(event.currentTarget));");
    expect(editor).not.toContain("<form action={submit}");
  });

  it("surfaces field-specific validation errors", () => {
    expect(editor).toContain("setFieldErrors(nextFieldErrors)");
    expect(editor).toContain("aria-invalid={Boolean(fieldErrors.endTime)}");
    expect(editor).toContain("error={fieldErrors.recurrence?.[0]}");
  });
});
