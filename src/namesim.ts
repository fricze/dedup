// Splits camelCase / PascalCase / snake_case / kebab-case into lowercase tokens.
// "userId" -> ["user", "id"], "email_address" -> ["email", "address"]
function tokenize(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function tokenJaccard(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Similarity of two field names in [0, 1]. Combines token overlap (catches
// "userId" ~ "id", "emailAddress" ~ "email") with edit-distance ratio
// (catches "fname" ~ "name", typos) and takes the best signal.
export function nameSimilarity(a: string, b: string): number {
  if (a === b) return 1;

  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  const jaccard = tokenJaccard(tokensA, tokensB);
  const editRatio = levenshteinRatio(a.toLowerCase(), b.toLowerCase());

  return Math.max(jaccard, editRatio);
}
