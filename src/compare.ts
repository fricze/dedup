import type { TypeInfo, FieldShape } from "./extract.js";
import { nameSimilarity } from "./namesim.js";

// Minimum similarity for two nested object shapes to count as "the same
// nested shape" at all when scoring their parent fields.
const NESTED_MATCH_THRESHOLD = 0.5;

// "exact"  — every field lines up with the same name, type and optionality.
//            Safe to merge/alias immediately, no code changes needed at call sites.
// "fuzzy"  — structurally similar but at least one field was matched by name
//            (renamed field) or is unmatched. Same concept, needs a refactor
//            (rename fields / adjust call sites) before it can be unified.
export type MatchCategory = "exact" | "fuzzy";

export interface Match {
  a: TypeInfo;
  b: TypeInfo;
  similarity: number; // 0..1
  category: MatchCategory;
}

// Minimum name similarity for two differently-named fields to be considered
// "the same field" at all (e.g. userId~id, emailAddress~email).
const NAME_MATCH_THRESHOLD = 0.5;

interface SimilarityResult {
  similarity: number;
  category: MatchCategory;
}

// Field-pair score: optionality must match exactly. Primitive types must
// match exactly too. Object (nested literal) types recurse: the nested
// shapes are compared with the same bipartite matcher, and the nested
// result's similarity scales the pair's score (a field of a mostly-matching
// nested shape counts as a partial field match, not a hard 0/1).
function fieldPairScore(x: FieldShape, y: FieldShape): { score: number; exact: boolean } {
  if (x.optional !== y.optional) return { score: 0, exact: false };

  if (x.type.kind === "primitive" && y.type.kind === "primitive") {
    if (x.type.text !== y.type.text) return { score: 0, exact: false };
    const nameSim = nameSimilarity(x.name, y.name);
    if (nameSim < NAME_MATCH_THRESHOLD) return { score: 0, exact: false };
    return { score: nameSim, exact: x.name === y.name };
  }

  if (x.type.kind === "object" && y.type.kind === "object") {
    const nested = computeFieldListSimilarity(x.type.fields, y.type.fields);
    if (nested.similarity < NESTED_MATCH_THRESHOLD) return { score: 0, exact: false };
    const nameSim = nameSimilarity(x.name, y.name);
    if (nameSim < NAME_MATCH_THRESHOLD) return { score: 0, exact: false };
    return {
      score: nameSim * nested.similarity,
      exact: x.name === y.name && nested.category === "exact",
    };
  }

  return { score: 0, exact: false }; // primitive vs object: not comparable
}

// Greedy best-match bipartite matching between two field lists, then treat
// the matched pairs like fractional set-intersection (generalized Jaccard):
// similarity = sum(matched scores) / (unmatched-A + unmatched-B + matched count)
function computeFieldListSimilarity(fieldsA: FieldShape[], fieldsB: FieldShape[]): SimilarityResult {
  if (fieldsA.length === 0 && fieldsB.length === 0) return { similarity: 0, category: "fuzzy" };

  const candidates: { i: number; j: number; score: number; exact: boolean }[] = [];
  for (let i = 0; i < fieldsA.length; i++) {
    for (let j = 0; j < fieldsB.length; j++) {
      const { score, exact } = fieldPairScore(fieldsA[i], fieldsB[j]);
      if (score > 0) candidates.push({ i, j, score, exact });
    }
  }
  candidates.sort((p, q) => q.score - p.score);

  const usedA = new Set<number>();
  const usedB = new Set<number>();
  let matchedScore = 0;
  let matchedCount = 0;
  let allExact = true;

  for (const { i, j, score, exact } of candidates) {
    if (usedA.has(i) || usedB.has(j)) continue;
    usedA.add(i);
    usedB.add(j);
    matchedScore += score;
    matchedCount++;
    if (!exact) allExact = false;
  }

  const unmatched = fieldsA.length - matchedCount + (fieldsB.length - matchedCount);
  const denom = matchedCount + unmatched;
  const sim = denom === 0 ? 0 : matchedScore / denom;

  // Exact only when every field matched exactly (name, type, optionality,
  // and — for nested object fields — the nested shape recursively exact too).
  const category: MatchCategory = allExact && unmatched === 0 ? "exact" : "fuzzy";
  return { similarity: sim, category };
}

function computeSimilarity(a: TypeInfo, b: TypeInfo): SimilarityResult {
  return computeFieldListSimilarity(a.fields, b.fields);
}

export function findMatches(types: TypeInfo[], threshold: number): Match[] {
  const matches: Match[] = [];

  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      const a = types[i];
      const b = types[j];

      // skip same declaration (shouldn't happen) and empty-field shapes
      if (a.fields.length === 0 || b.fields.length === 0) continue;

      const { similarity: sim, category } = computeSimilarity(a, b);
      if (sim >= threshold) {
        matches.push({ a, b, similarity: sim, category });
      }
    }
  }

  return matches.sort((x, y) => y.similarity - x.similarity);
}

// Group matches into connected components so A~B~C shows as one cluster.
export function groupMatches(matches: Match[]): Match[][] {
  const parent = new Map<TypeInfo, TypeInfo>();

  function find(t: TypeInfo): TypeInfo {
    let root = t;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(t, root);
    return root;
  }

  function union(a: TypeInfo, b: TypeInfo): void {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const m of matches) union(m.a, m.b);

  const groups = new Map<TypeInfo, Match[]>();
  for (const m of matches) {
    const root = find(m.a);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(m);
  }

  return [...groups.values()];
}
