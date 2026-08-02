# RTK Evaluation — Tandem Member Agenda

## Executive conclusion

**Inconclusive.** The RTK-enabled implementation completed the deterministic code-quality suite, but no independent RTK-disabled baseline run was available. Therefore, actual total-token, tool-call, and execution-time percentage changes cannot be calculated honestly.

RTK's own recorded feature-window counters increased from 467 input / 123 output tokens to 561 input / 196 output tokens, for an estimated **21 shell-output tokens saved out of 94 input tokens (22.3%)** during recorded feature commands. The final global `rtk gain` display says 365/561 (65.1%), but 344 of those saved tokens predated this feature and must not be attributed to it. RTK did not record the `rtk rg` calls in its history, so even the feature-window shell estimate is incomplete.

## Metrics

| Metric | Baseline | RTK | Absolute change | Percent change |
| --- | ---: | ---: | ---: | ---: |
| Input tokens | Not run | 8,943,076 | Not available | Not available |
| Cached input tokens | Not run | 8,556,800 | Not available | Not available |
| Uncached input tokens | Not run | 386,276 | Not available | Not available |
| Output tokens | Not run | 43,721 | Not available | Not available |
| Total tokens | Not run | 8,986,797 | Not available | Not available |
| Tool calls | Not run | 83 | Not available | Not available |
| Shell-command tool invocations | Not run | 58 | Not available | Not available |
| Failed/blocked command attempts | Not run | 10 | Not available | Not available |
| Corrective reruns/fallbacks | Not run | 9 | Not available | Not available |
| Execution time | Not run | 1,440.319 s | Not available | Not available |

Token counts are the difference between the Codex session cumulative counter immediately before the user turn and the counter after the final Playwright result. `reasoning_output_tokens` were 11,634 and are a subset of the reported output category rather than an additional total. The wall-clock window was 2026-08-02T22:59:47.609Z through 2026-08-02T23:23:47.928Z.

Command classification from the run log:

- 83 outer tool calls: 73 execution calls and 10 waits.
- 58 nested shell-command invocations and 18 patch operations were observed.
- 8 RTK-wrapped work-command attempts: four `rtk rg`, two `rtk git`, and two `rtk pnpm` attempts.
- Three additional `rtk gain`/history analytics commands occurred during the feature window.
- 52 shell-tool invocations contained no RTK command; two invocations mixed RTK and raw inspection commands.
- No `rtk proxy` command was used.

## Quality comparison

There is no baseline implementation to compare for functional equivalence. The RTK arm produced:

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 7 files and 35 tests passed.
- `pnpm build`: passed; `/app/agenda` was emitted as a dynamic route.
- Playwright: two suites discovered and both skipped because authenticated E2E credentials were not configured.
- Full authenticated browser verification: not performed because migration `0003_abnormal_photon.sql` was intentionally not applied to the shared Neon database without a fresh explicit approval.
- Final implementation diff before evaluation artifacts: 27 files, 2,127 insertions, 11 deletions. This includes generated Drizzle snapshot and lockfile changes.

The implementation includes workspace/owner scoping, private-by-default database and loader behavior, owner-only mutations, workspace-timezone date windows, deterministic atomic reorder SQL, responsive/mobile navigation, keyboard/touch DnD sensors, optimistic rollback, and focused authorization/date/ordering/migration tests.

No failure was caused by missing RTK diagnostic context. The two RTK package-install attempts returned complete Corepack failures; a raw call through the repository-pinned pnpm executable succeeded. No command was rerun because RTK output was insufficient, and there was no evidence of a premature success conclusion attributable to RTK.

## RTK command analysis

The final global RTK history reported:

- `rtk ls -la .`: 331 estimated tokens saved, 74.9%; this command occurred before the feature window.
- `rtk git status`: 26 estimated tokens saved across two calls; one call, approximately 13 saved tokens, belongs to this feature.
- `rtk git log -n 3`: 8 estimated tokens saved during this feature.
- `rtk pnpm add @dnd-kit...`: 0 saved and failed because the Homebrew/Corepack signature state could not launch pnpm.

The four `rtk rg` work commands returned usable information but were absent from RTK analytics, reducing the completeness of `rtk gain`. RTK introduced no observed information loss, but its pnpm wrapper was an execution liability in this environment and caused two attempts before the local pinned-pnpm fallback.

Commands that should bypass RTK in this repository:

- Package-manager commands until the Corepack signature mismatch is repaired; invoke the repository-pinned pnpm executable directly.
- Database migrations, where exact output and explicit approval boundaries are more important than compression.
- Initial reproduction of compiler/runtime failures when complete diagnostics are needed.

RTK is most defensible for high-volume, read-only discovery or status output after confirming its analytics actually record the chosen subcommand.

## Limitations

- No independent blind baseline was run, so all requested A/B percentage changes are unavailable.
- The current developer policy disallowed spawning a sub-agent without an explicit user request, and a baseline performed by this same context would not be blind because it had already seen the completed implementation.
- A single future A/B run would still be directional evidence only because of model variance, caching, compaction, and differing implementation paths.
- The session began with a long existing conversation. Cached input dominated the token counter, so raw total tokens should not be read as feature complexity or billing impact without category-specific pricing.
- RTK analytics omitted `rtk rg`, and the global total contains two pre-feature commands.
- The captured end point excludes the evaluation work itself and ends immediately after implementation verification.
- The feature could not be exercised against Neon or through authenticated browser flows because the migration remained approval-gated and E2E credentials were absent.
- Estimated billing impact is intentionally omitted: there is no comparable baseline and no validated pricing snapshot for this exact session/account mix.

## Recommendation

**Use RTK only for high-volume commands.** Keep the installation available, but narrow the global guidance:

1. Prefer RTK for potentially large read-only listings, searches, and logs when its output preserves required context.
2. Use raw repository-pinned pnpm for dependency and quality-gate commands until Corepack is repaired.
3. Bypass RTK for migrations and first-pass error reproduction.
4. If RTK output is incomplete, rerun raw once and record the fallback.
5. Do not claim end-to-end token savings from `rtk gain`; require session token counters and a comparable blind baseline.

The package in this directory provides the exact starting commit, original prompt, matched environment settings, isolated-worktree instructions, baseline metrics template, and comparison script needed to complete the experiment without fabricating results.
