import { config } from "dotenv";
import { addDays, addHours, startOfDay } from "date-fns";

import { localDateTimeToUtc } from "../src/lib/dates/timezone";

config({ path: ".env.local" });

const ids = {
  workspace: "10000000-0000-4000-8000-000000000001",
  home: "20000000-0000-4000-8000-000000000001",
  work: "20000000-0000-4000-8000-000000000002",
  errands: "20000000-0000-4000-8000-000000000003",
} as const;

async function main() {
  const userA = process.env.SEED_USER_A_ID;
  const userB = process.env.SEED_USER_B_ID;
  if (!userA || !userB) throw new Error("Set SEED_USER_A_ID and SEED_USER_B_ID to Neon Auth user IDs before seeding.");

  const [{ db }, schema] = await Promise.all([import("../src/lib/db/client"), import("./schema")]);
  const timezone = "America/Chicago";
  const today = new Date();
  const day = (offset: number) => addDays(startOfDay(today), offset).toISOString().slice(0, 10);

  await db.insert(schema.workspaces).values({ id: ids.workspace, name: "Our life", timezone, createdBy: userA }).onConflictDoNothing();
  await db.insert(schema.workspaceMembers).values([
    { workspaceId: ids.workspace, userId: userA, displayName: process.env.SEED_USER_A_NAME || "Nick" },
    { workspaceId: ids.workspace, userId: userB, displayName: process.env.SEED_USER_B_NAME || "Alex" },
  ]).onConflictDoNothing();
  await db.insert(schema.taskLists).values([
    { id: ids.home, workspaceId: ids.workspace, name: "Home", color: "#0f766e", position: 0 },
    { id: ids.work, workspaceId: ids.workspace, name: "Work", color: "#2563eb", position: 1 },
    { id: ids.errands, workspaceId: ids.workspace, name: "Errands", color: "#d97706", position: 2 },
  ]).onConflictDoNothing();

  await db.insert(schema.tasks).values([
    { workspaceId: ids.workspace, listId: ids.home, title: "Order dog food", dueAt: localDateTimeToUtc({ date: day(0) }, timezone), assigneeUserId: userB, priority: "medium", createdBy: userA, updatedBy: userA },
    { workspaceId: ids.workspace, listId: ids.work, title: "Submit reimbursement", notes: "Rental car documents", dueAt: localDateTimeToUtc({ date: day(1), time: "16:00" }, timezone), dueIsAllDay: false, assigneeUserId: userA, priority: "high", createdBy: userA, updatedBy: userA },
    { workspaceId: ids.workspace, listId: ids.errands, title: "Book rental car", dueAt: localDateTimeToUtc({ date: day(3) }, timezone), assigneeUserId: userA, priority: "medium", createdBy: userB, updatedBy: userB },
    { workspaceId: ids.workspace, listId: ids.home, title: "Replace furnace filter", notes: "20x25x1", priority: "low", createdBy: userB, updatedBy: userB },
    { workspaceId: ids.workspace, listId: ids.errands, title: "Pick up dry cleaning", dueAt: localDateTimeToUtc({ date: day(-1) }, timezone), completedAt: new Date(), assigneeUserId: userB, createdBy: userA, updatedBy: userB },
  ]);

  const dinnerStart = localDateTimeToUtc({ date: day(0), time: "18:30" }, timezone);
  const dentistStart = localDateTimeToUtc({ date: day(2), time: "08:30" }, timezone);
  const allDayStart = localDateTimeToUtc({ date: day(4) }, timezone);
  await db.insert(schema.events).values([
    { workspaceId: ids.workspace, title: "Dinner with Mom", location: "Downtown", startAt: dinnerStart, endAt: addHours(dinnerStart, 2), color: "blue", createdBy: userA, updatedBy: userA },
    { workspaceId: ids.workspace, title: "Dentist", description: "Bring insurance card", location: "Falls Dental", startAt: dentistStart, endAt: addHours(dentistStart, 1), color: "violet", createdBy: userB, updatedBy: userB },
    { workspaceId: ids.workspace, title: "Garbage day", startAt: allDayStart, endAt: addDays(allDayStart, 1), allDay: true, color: "teal", recurrence: "weekly", createdBy: userA, updatedBy: userA },
  ]);

  console.log("Tandem demo data created.");
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
