# dedup

<img src="logo.png" alt="dedup" width="300">

Find duplicate and similar TypeScript type/interface declarations across a codebase — candidates for deduplication.

## Usage

```
npx @yonki/dedup <dir> [<dir> ...] [--threshold 0.7]
```

- `<dir>` — one or more directories to scan (`.ts`/`.tsx`, recursive)
- `-t, --threshold` — similarity threshold, `0`–`1` (default `0.7`). `1` = identical only.

Example:

```
npx @yonki/dedup src --threshold 0.6
npx @yonki/dedup src packages/shared -t 0.8
```

## Output

Results are split into two sections:

- **EXACT DUPLICATES** — same fields, same types, same optionality. Safe to merge/alias immediately.
- **SIMILAR TYPES** — same shape but a field was renamed, added, removed, or made optional. Needs a refactor before merging.

Nested object-literal fields (e.g. `address: { street, city }`) are compared recursively and also reported as their own standalone candidates.

## Try it

```
npx @yonki/dedup examples
```

## MCP server

Exposes a `find_duplicates` tool over stdio so an LLM can pull the results and decide what to do with them.

Tool input: `{ dirs: string[], threshold?: number }`. Returns `exactDuplicates` and `similarTypes` as JSON — same grouping as the CLI, no formatting/colors, meant for the model to read. Each call re-scans the directories fresh; no session state kept between calls.

Use `npx -p @yonki/dedup dedup-mcp` in every config below.

### Claude Code

```
claude mcp add dedup -- npx -p @yonki/dedup dedup-mcp
```

### Claude Desktop

Edit `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "dedup": {
      "command": "npx",
      "args": ["-p", "@yonki/dedup", "dedup-mcp"]
    }
  }
}
```

### Codex CLI

```
codex mcp add dedup -- npx -p @yonki/dedup dedup-mcp
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.dedup]
command = "npx"
args = ["-p", "@yonki/dedup", "dedup-mcp"]
```

### Cursor

`.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "dedup": {
      "command": "npx",
      "args": ["-p", "@yonki/dedup", "dedup-mcp"]
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "dedup": {
      "command": "npx",
      "args": ["-p", "@yonki/dedup", "dedup-mcp"]
    }
  }
}
```

### Cline / Roo Code / Kilo Code

All three read the same shape, via each extension's "MCP Servers" panel → "Configure MCP Servers" (opens `cline_mcp_settings.json` / `roo_mcp_settings.json` / `kilocode_mcp_settings.json`):

```json
{
  "mcpServers": {
    "dedup": {
      "command": "npx",
      "args": ["-p", "@yonki/dedup", "dedup-mcp"]
    }
  }
}
```

### Gemini CLI

```
gemini mcp add dedup npx -p @yonki/dedup dedup-mcp
```

Or in `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "dedup": {
      "command": "npx",
      "args": ["-p", "@yonki/dedup", "dedup-mcp"]
    }
  }
}
```

### VS Code (Copilot agent mode)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "dedup": {
      "command": "npx",
      "args": ["-p", "@yonki/dedup", "dedup-mcp"]
    }
  }
}
```

### Amazon Q Developer CLI

`~/.aws/amazonq/mcp.json`:

```json
{
  "mcpServers": {
    "dedup": {
      "command": "npx",
      "args": ["-p", "@yonki/dedup", "dedup-mcp"]
    }
  }
}
```
