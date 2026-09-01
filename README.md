# dedup

<img src="logo.png" alt="dedup" width="300">

Find duplicate and similar TypeScript type/interface declarations across a codebase — candidates for deduplication.

## Install

```
npm install
npm run build
```

## Usage

```
node dist/cli.js <dir> [<dir> ...] [--threshold 0.7]
```

- `<dir>` — one or more directories to scan (`.ts`/`.tsx`, recursive)
- `-t, --threshold` — similarity threshold, `0`–`1` (default `0.7`). `1` = identical only.

Example:

```
node dist/cli.js src --threshold 0.6
node dist/cli.js src packages/shared -t 0.8
```

## Output

Results are split into two sections:

- **EXACT DUPLICATES** — same fields, same types, same optionality. Safe to merge/alias immediately.
- **SIMILAR TYPES** — same shape but a field was renamed, added, removed, or made optional. Needs a refactor before merging.

Nested object-literal fields (e.g. `address: { street, city }`) are compared recursively and also reported as their own standalone candidates.

## Try it

```
node dist/cli.js examples
```
