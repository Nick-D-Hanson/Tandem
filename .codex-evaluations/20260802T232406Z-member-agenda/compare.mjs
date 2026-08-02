import { readFileSync } from "node:fs";

const [baselinePath, rtkPath] = process.argv.slice(2);
if (!baselinePath || !rtkPath) {
  console.error("Usage: node compare.mjs BASELINE_METRICS.json RUN_METRICS.json");
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const rtk = JSON.parse(readFileSync(rtkPath, "utf8"));
const metrics = [
  ["Input tokens", baseline.tokens.input, rtk.tokens.input],
  ["Cached input tokens", baseline.tokens.cached_input, rtk.tokens.cached_input],
  ["Output tokens", baseline.tokens.output, rtk.tokens.output],
  ["Total tokens", baseline.tokens.total, rtk.tokens.total],
  ["Tool calls", baseline.tool_calls, rtk.tool_calls],
  ["Failed/blocked attempts", baseline.failed_or_blocked_attempts, rtk.failed_or_blocked_attempts],
  ["Corrective reruns/fallbacks", baseline.corrective_reruns_or_fallbacks, rtk.corrective_reruns_or_fallbacks],
  ["Execution time (s)", baseline.wall_clock_seconds, rtk.wall_clock_seconds],
];

console.log("| Metric | Baseline | RTK | Absolute change | Percent change |");
console.log("| --- | ---: | ---: | ---: | ---: |");
for (const [label, base, enabled] of metrics) {
  if (typeof base !== "number" || typeof enabled !== "number") {
    console.log(`| ${label} | ${base ?? "N/A"} | ${enabled ?? "N/A"} | N/A | N/A |`);
    continue;
  }
  const delta = enabled - base;
  const percent = base === 0 ? null : delta / base * 100;
  console.log(`| ${label} | ${base} | ${enabled} | ${delta} | ${percent === null ? "N/A" : `${percent.toFixed(2)}%`} |`);
}
