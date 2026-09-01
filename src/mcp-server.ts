#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Project } from "ts-morph";
import path from "node:path";
import { z } from "zod";
import { extractTypes } from "./extract.js";
import { findMatches, groupMatches, type Match } from "./compare.js";

// stateless: every call re-scans from scratch, no session/cache kept between requests
function scan(dirs: string[], threshold: number) {
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
  const matches = findMatches(types, threshold);
  const groups = groupMatches(matches);

  const exactGroups = groups.filter((g) => g.every((m) => m.category === "exact"));
  const fuzzyGroups = groups.filter((g) => g.some((m) => m.category === "fuzzy"));

  return {
    filesScanned: project.getSourceFiles().length,
    typesFound: types.length,
    exactDuplicates: exactGroups.map(formatGroup),
    similarTypes: fuzzyGroups.map(formatGroup),
  };
}

function formatGroup(group: Match[]) {
  const membersByKey = new Map<string, Match["a"]>();
  for (const m of group) {
    membersByKey.set(`${m.a.name}:${m.a.filePath}:${m.a.line}`, m.a);
    membersByKey.set(`${m.b.name}:${m.b.filePath}:${m.b.line}`, m.b);
  }
  const members = [...membersByKey.values()];
  const worstSimilarity = Math.min(...group.map((m) => m.similarity));

  return {
    similarity: Math.round(worstSimilarity * 100) / 100,
    members: members.map((t) => ({
      name: t.name,
      kind: t.kind,
      filePath: t.filePath,
      line: t.line,
      fields: t.fields,
    })),
  };
}

const server = new McpServer({ name: "dedup", version: "0.1.0" });

server.registerTool(
  "find_duplicates",
  {
    title: "Find duplicate TypeScript types",
    description:
      "Scan TypeScript directories for duplicate and similar type/interface declarations. " +
      "Returns exact duplicates (safe to merge immediately) and similar types (same shape, " +
      "needs a refactor first) so the LLM/user can decide what to do with each group.",
    inputSchema: {
      dirs: z.array(z.string()).min(1).describe("Directories to scan, relative or absolute"),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .default(0.7)
        .describe("Similarity threshold 0..1 (1 = identical only)"),
    },
  },
  async ({ dirs, threshold }) => {
    const result = scan(dirs, threshold);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
