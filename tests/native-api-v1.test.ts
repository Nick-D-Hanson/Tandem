import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildNativeApiContractArtifact } from "@/lib/api/v1/contract-artifact";
import { apiFailureSchema, apiMeSuccessSchema } from "@/lib/api/v1/contracts";
import { buildMeData } from "@/lib/api/v1/me-data";
import { createMeHandler } from "@/lib/api/v1/me-handler";

const workspaceId = "3344cc5f-bb0f-4c38-894d-a79122869f1d";
const generatedAt = new Date("2026-08-15T17:00:00.000Z");

const context = {
  user: { id: "user-1", email: "nick@example.com", name: "Nick", image: null },
  membership: { workspaceId, displayName: "Nick", avatarUrl: null },
};

const workspace = { id: workspaceId, name: "Our space", timezone: "America/Chicago" };
const members = [
  { workspaceId, userId: "user-1", displayName: "Nick", avatarUrl: null },
  { workspaceId, userId: "user-2", displayName: "Alex", avatarUrl: "https://example.com/alex.png" },
];

describe("native API v1 /me", () => {
  it("returns a validated, bounded current-user/workspace response", async () => {
    const data = buildMeData(context, workspace, members, generatedAt);
    const response = await createMeHandler(async () => data)();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-tandem-api-version")).toBe("v1");
    expect(apiMeSuccessSchema.parse(body).data).toEqual(data);
    expect(JSON.stringify(body)).not.toMatch(/createdBy|cookie|secret|token|DATABASE_URL/i);
  });

  it("returns 401 with the stable error envelope when unauthenticated", async () => {
    const response = await createMeHandler(async () => { throw new Error("AUTH_REQUIRED"); })();
    const body = apiFailureSchema.parse(await response.json());

    expect(response.status).toBe(401);
    expect(body.error).toEqual({ code: "UNAUTHORIZED", message: "Authentication is required." });
  });

  it("does not serialize a workspace or member from another workspace", () => {
    expect(() => buildMeData(context, { ...workspace, id: "273ace7f-0633-45f7-b2e7-8c0056a60646" }, members, generatedAt)).toThrow("NOT_FOUND");
    expect(() => buildMeData(context, workspace, [{ ...members[0], workspaceId: "273ace7f-0633-45f7-b2e7-8c0056a60646" }], generatedAt)).toThrow("NOT_FOUND");
  });

  it("returns a generic 500 envelope without internal details", async () => {
    const response = await createMeHandler(async () => { throw new Error("database password leaked"); })();
    const body = apiFailureSchema.parse(await response.json());

    expect(response.status).toBe(500);
    expect(body.error).toEqual({ code: "INTERNAL_ERROR", message: "The request could not be completed." });
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("keeps the checked contract artifact deterministic", async () => {
    const artifact = JSON.parse(await readFile("contracts/native-api-v1.json", "utf8"));
    expect(artifact).toEqual(buildNativeApiContractArtifact());
  });
});
