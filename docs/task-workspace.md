# Unified task workspace

`/app/my-list` is the primary shared-task workspace. It presents the same authenticated `tasks` records in three coordinated groupings:

- Week: Monday-through-Sunday planned work, based on `tasks.scheduled_date`.
- Backlog: tasks whose `scheduled_date` is `NULL`, regardless of deadline.
- Matrix: explicit `tasks.quadrant` values 1–4 plus an unclassified inbox.

The existing `due_at` field remains a deadline and is never used to infer a planned work date or matrix priority. Existing tasks migrate to Backlog and Unclassified because both new columns are nullable and the migration performs no data backfill. The existing `position` field supplies persisted ordering within the current planner grouping.

All creates, edits, completions, deletions, moves, and reorders continue through authenticated Server Actions and workspace-scoped queries. Drag operations are optimistic; a failed transaction restores the previous client state. Every drag operation also has a task-menu alternative.

Calendar task rendering continues to use deadlines, preserving its existing behavior while the weekly workspace uses planned work dates.

## Migration

`db/migrations/0009_amused_kate_bishop.sql` adds:

- nullable `tasks.scheduled_date`;
- nullable `tasks.quadrant`, constrained to 1–4;
- planner grouping indexes and a non-negative `position` constraint.

Test the migration on a Neon development branch with a direct, non-pooled connection before applying it to production.
