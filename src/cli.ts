#!/usr/bin/env node
import { Project } from "ts-morph";
import path from "node:path";
import { styleText } from "node:util";
import { extractTypes, type TypeInfo, type FieldShape } from "./extract.js";
import { findMatches, groupMatches, type Match, type MatchCategory } from "./compare.js";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
function c(styles: Parameters<typeof styleText>[0], text: string): string {
  return useColor ? styleText(styles, text) : text;
}

function similarityColor(sim: number): Parameters<typeof styleText>[0] {
  if (sim >= 0.9) return "green";
  if (sim >= 0.7) return "yellow";
  return "red";
}

function parseArgs(argv: string[]) {
  const dirs: string[] = [];
  let threshold = 0.7;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--threshold" || arg === "-t") {
      threshold = parseFloat(argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      dirs.push(arg);
    }
  }

  return { dirs, threshold };
}

function printHelp() {
  console.log(`dedup - find duplicate/similar TS type declarations

Usage:
  dedup <dir> [<dir> ...] [--threshold 0.7]

Options:
  -t, --threshold  Similarity threshold 0..1 (1 = identical only). Default 0.7
  -h, --help       Show this help
`);
}

function main() {
  const { dirs, threshold } = parseArgs(process.argv.slice(2));

  if (dirs.length === 0) {
    printHelp();
    process.exit(1);
  }

  const project = new Project({ skipAddingFilesFromTsConfig: true });

  for (const dir of dirs) {
    const abs = path.resolve(dir);
    project.addSourceFilesAtPaths([
      `${abs}/**/*.ts`,
      `${abs}/**/*.tsx`,
      `!${abs}/**/*.d.ts`,
      `!${abs}/**/node_modules/**`,
    ]);
  }

  const types = extractTypes(project);
  console.log(
    c("dim", `Scanned ${project.getSourceFiles().length} files, found ${types.length} type/interface declarations.\n`)
  );

  const matches = findMatches(types, threshold);
  if (matches.length === 0) {
    console.log(c("green", "No duplicate/similar type candidates found."));
    return;
  }

  const groups = groupMatches(matches);

  // A group is "exact" only if every pairwise match inside it is exact.
  // One fuzzy edge (a renamed field) means the group needs a refactor to
  // fully unify, even if some pairs within it already line up perfectly.
  const exactGroups = groups.filter((g) => g.every((m) => m.category === "exact"));
  const fuzzyGroups = groups.filter((g) => g.some((m) => m.category === "fuzzy"));

  console.log(c(["bold"], `Found ${groups.length} group(s) of duplicate/similar types:\n`));

  if (exactGroups.length > 0) {
    console.log(c(["bold", "green"], `▸ EXACT DUPLICATES — merge immediately (${exactGroups.length})`));
    console.log(c("dim", "  Same fields, same types, same optionality. Safe to alias/merge as-is.\n"));
    exactGroups.forEach((group, idx) => printGroup(group, idx, "exact"));
  }

  if (fuzzyGroups.length > 0) {
    console.log(c(["bold", "yellow"], `▸ SIMILAR TYPES — needs refactor (${fuzzyGroups.length})`));
    console.log(c("dim", "  Same shape but field names differ. Rename/align fields before merging.\n"));
    fuzzyGroups.forEach((group, idx) => printGroup(group, idx, "fuzzy"));
  }
}

function printGroup(group: Match[], idx: number, category: MatchCategory) {
  const membersByKey = new Map<string, TypeInfo>();
  for (const m of group) {
    membersByKey.set(fmt(m.a), m.a);
    membersByKey.set(fmt(m.b), m.b);
  }
  const members = [...membersByKey.values()];
  // Show the weakest edge, not the strongest — the group's "N% similar" claim
  // should hold for every member, not just the closest pair inside it.
  const worst = Math.min(...group.map((m) => m.similarity));
  const simColor = similarityColor(worst);
  const bannerColor = category === "exact" ? "green" : "yellow";

  const title = `Group ${idx + 1}  ${c(simColor, `${(worst * 100).toFixed(0)}% similar (weakest pair)`)}  ${c(
    "dim",
    `(${members.length} types)`
  )}`;
  console.log(c(bannerColor, "━".repeat(70)));
  console.log(title);
  console.log(c(bannerColor, "━".repeat(70)));

  // union of all field names across the group, to know which fields are shared vs unique
  const fieldCountByName = new Map<string, number>();
  for (const t of members) {
    for (const f of t.fields) {
      fieldCountByName.set(f.name, (fieldCountByName.get(f.name) ?? 0) + 1);
    }
  }

  members.forEach((t, i) => {
    console.log(`\n${c("dim", `[${i + 1}] ${t.filePath}:${t.line}`)}`);
    console.log(`    ${c(["bold"], t.name)} ${c("magenta", `(${t.kind})`)}`);
    for (const f of t.fields) {
      const sharedByAll = fieldCountByName.get(f.name) === members.length;
      printField(f, sharedByAll, 3);
    }
  });
  console.log();
}

function printField(f: FieldShape, sharedByAll: boolean, indent: number) {
  const pad = "  ".repeat(indent);
  const marker = sharedByAll ? c("dim", "·") : c("yellow", "!");
  const optToken = f.optional ? "?" : "";
  const label = `${f.name}${optToken}`;

  if (f.type.kind === "primitive") {
    const rendered = sharedByAll ? `${label}: ${c("blue", f.type.text)}` : c("yellow", `${label}: ${f.type.text}`);
    console.log(`${pad}${marker} ${rendered}`);
    return;
  }

  // nested object literal: print the field as an opening brace, then recurse
  console.log(`${pad}${marker} ${sharedByAll ? `${label}: {` : c("yellow", `${label}: {`)}`);
  for (const nested of f.type.fields) {
    printField(nested, sharedByAll, indent + 1);
  }
  console.log(`${pad}  }`);
}

function fmt(t: { name: string; kind: string; filePath: string; line: number }) {
  return `${t.name} (${t.kind})  ${t.filePath}:${t.line}`;
}

main();
