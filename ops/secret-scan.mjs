import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const skipped = new Set([".git", ".next", ".turbo", "coverage", "dist", "node_modules", "playwright-report", "test-results"]);
const extensions = new Set([".js", ".json", ".md", ".mjs", ".ts", ".tsx", ".yaml", ".yml"]);
const signatures = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { name: "OpenAI-style key", pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ }
];
const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (extensions.has(extname(entry.name))) {
      if (relative(root, path).replaceAll("\\", "/") === "ops/secret-scan.mjs") continue;
      const content = await readFile(path, "utf8");
      for (const signature of signatures) if (signature.pattern.test(content)) findings.push(`${relative(root, path)}: ${signature.name}`);
    }
  }
}

await walk(root);
if (findings.length) { process.stderr.write(`Potential committed secrets found:\n${findings.join("\n")}\n`); process.exitCode = 1; }
else process.stdout.write("Secret signature scan: PASS\n");
