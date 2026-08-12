# webcmd-mcp

MCP server for [Webcmd](https://github.com/agentrhq/webcmd). Drop one entry into any agent's
MCP config and it can drive websites locally — no `start.md` fetch, no skill files copied into
the repo, no per-harness onboarding.

## Install

Nothing to install ahead of time. `webcmd_setup` installs and doctors the CLI on first call.

### Claude Code

```bash
claude mcp add webcmd -- npx -y @agentrhq/webcmd-mcp
```

### Cursor / Windsurf / VS Code / anything using `mcpServers`

```json
{
  "mcpServers": {
    "webcmd": { "command": "npx", "args": ["-y", "@agentrhq/webcmd-mcp"] }
  }
}
```

### Codex CLI (`~/.codex/config.toml`)

```toml
[mcp_servers.webcmd]
command = "npx"
args = ["-y", "@agentrhq/webcmd-mcp"]
```

### OpenCode (`opencode.json`)

```json
{
  "mcp": {
    "webcmd": { "type": "local", "command": ["npx", "-y", "@agentrhq/webcmd-mcp"], "enabled": true }
  }
}
```

## Tools

| Tool | Use |
| --- | --- |
| `webcmd_setup` | Once per machine: install/update webcmd, run `doctor`, return the usage skill. |
| `webcmd_skill` | Read a bundled skill (`webcmd-usage`, `webcmd-browser`, `webcmd-adapter-author`, `webcmd-autofix`, …). No name → list them. |
| `webcmd_run` | Run any `webcmd` argv, e.g. `["list"]`, `["web","fetch-browser","https://news.ycombinator.com"]`. |

Skills are read from `~/.webcmd/skills` (override with `WEBCMD_SKILLS_DIR`).

## Test

```bash
npm install && npm test
```

Covers the exec helper (exit codes, stderr, missing binary, timeout), output clipping, and a real
stdio round-trip against the live `webcmd` CLI.
