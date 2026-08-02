# Blind RTK-disabled baseline package

This package is for a separate clean Codex session. Do not run the baseline from a context that has seen the RTK implementation or its diff.

## Comparability contract

- Starting commit: `6533a63ee4d64bd7d93025759fc7f5fd01ec17a4`
- Original prompt: `ORIGINAL_IMPLEMENTATION_PROMPT.txt`
- Packaged prompt SHA-256: `e7f71acb9eec283c1f938961ffdf5d0ded0a20c162ccd3a7fcc23526cfb3987f`
- Source attachment SHA-256: `c4e8052e1d1135b2a831403bae0046aa98ce5dfba8a8985b08a519a09f5a5a7f` (the packaged copy differs only by a final newline required by the patch writer)
- Model: `gpt-5.6-sol`
- Reasoning effort: `high`
- Collaboration mode: Default
- Approval policy: on-request
- Sandbox: workspace-write, network disabled unless individually approved
- Codex Desktop/CLI version observed: `0.144.2`
- Node: `v23.6.1`
- pnpm: `11.18.0`
- RTK must be disabled only for this isolated session.
- Use the same `.env.local` values without displaying or committing them.
- Run the same required typecheck, lint, unit test, build, and conditional Playwright commands.
- Do not apply the migration without the same fresh explicit approval boundary.

## Create the isolated worktree

Run from the primary repository:

```bash
git worktree add --detach /private/tmp/coupled-agenda-baseline 6533a63ee4d64bd7d93025759fc7f5fd01ec17a4
cp -p /Users/nick/Documents/Coupled/.env.local /private/tmp/coupled-agenda-baseline/.env.local
```

The environment file copy contains secrets. Keep it local, do not print it, and remove the temporary worktree through the normal Git worktree cleanup process after measurements are preserved.

## Disable only RTK guidance

Launch the baseline in a clean Codex home that retains the same model/configuration but has a non-RTK `AGENTS.md`. Do not modify `/Users/nick/.codex` and do not uninstall RTK globally.

One safe setup is:

1. Create a private temporary Codex home such as `/private/tmp/codex-baseline-home` with permissions `0700`.
2. Copy the required Codex config/auth material into it without printing contents.
3. Copy the global `AGENTS.md` into the temporary home and remove only the managed RTK policy block and the `RTK.md` reference.
4. Do not copy `RTK.md`.
5. Start a new Codex session with that temporary directory configured as Codex home, model `gpt-5.6-sol`, and reasoning effort `high`.
6. Verify the new session has no RTK instruction before providing the prompt.

If the launcher cannot safely override Codex home without changing authentication or other configuration, stop. Do not substitute a same-context rerun because it would not be blind.

## Baseline prompt

Give the clean session exactly the contents of `ORIGINAL_IMPLEMENTATION_PROMPT.txt`. Do not provide this evaluation report, completed diff, file list, implementation summary, or any learned fixes.

## Required commands and evidence

Capture timestamps and session token counters immediately before the prompt and immediately after final verification. Record every tool call, failure, repeat, and raw shell invocation.

Run the repository-equivalent commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
git diff --stat
git status --short
```

Playwright must retain the normal credentials-based skip behavior. Do not add an authentication bypass. Do not apply the shared Neon migration merely to complete the measurement.

Copy `BASELINE_METRICS_TEMPLATE.json` to `BASELINE_METRICS.json`, replace every `null` with measured values or a documented unavailable state, and preserve raw command output beside it.

## Comparability review

Before calculating deltas, verify:

- Exact starting commit matches.
- Packaged prompt hash matches.
- Model and reasoning effort match.
- Node, pnpm, dependencies, environment variables, permissions, and approval decisions are equivalent.
- Both arms pass equivalent deterministic tests.
- The baseline did not inspect the completed RTK implementation.
- Functional behavior and security invariants are materially equivalent.

If any item differs, flag it before interpreting the numbers. Then run `node compare.mjs BASELINE_METRICS.json RUN_METRICS.json`.
