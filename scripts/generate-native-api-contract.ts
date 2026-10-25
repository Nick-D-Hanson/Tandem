import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildNativeApiContractArtifact } from "../src/lib/api/v1/contract-artifact";

async function main() {
  const target = resolve(process.cwd(), "contracts/native-api-v1.json");
  const expected = `${JSON.stringify(buildNativeApiContractArtifact(), null, 2)}\n`;

  if (process.argv.includes("--check")) {
    const current = await readFile(target, "utf8").catch(() => "");
    if (current !== expected) {
      console.error("contracts/native-api-v1.json is stale. Run pnpm api:contract.");
      process.exitCode = 1;
    } else {
      console.log("Native API contract artifact is current.");
    }
  } else {
    await writeFile(target, expected);
    console.log("Generated contracts/native-api-v1.json.");
  }
}

void main();
