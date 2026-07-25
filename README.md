<p align="center">
  <img src="assets/logo.png" alt="Webs" width="88" height="88" />
</p>

<h1 align="center">Webs plugins</h1>

<p align="center"><strong>Give your agents the web as memory.</strong></p>

<p align="center">
  Webs is where the web becomes memory. This companion pack connects agents to
  the remote Webs MCP endpoint and teaches them when to save, recall, ask, and
  request context without stuffing memory into every prompt.
</p>

<p align="center">
  <a href="https://webs.creative-int.com">webs.creative-int.com</a> ·
  MCP: <code>https://webs.creative-int.com/mcp</code>
</p>

---

## Install

<!-- AUTO-GENERATED:INSTALL START -->

### Codex

Copy this Webs setup to `~/.codex/config.toml`. OAuth-capable clients authorize on first use; invoke `readiness` after connecting.

```toml
[mcp_servers.webs]
url = "https://webs.creative-int.com/mcp"
```

### Claude Code

Copy this Webs setup to `one terminal command`. OAuth-capable clients authorize on first use; invoke `readiness` after connecting.

```sh
claude mcp add --scope user --transport http webs 'https://webs.creative-int.com/mcp'
```

### Cursor

Copy this Webs setup to `.cursor/mcp.json`. OAuth-capable clients authorize on first use; invoke `readiness` after connecting.

```json
{
  "mcpServers": {
    "webs": {
      "type": "http",
      "url": "https://webs.creative-int.com/mcp"
    }
  }
}
```

### Windsurf

Copy this Webs setup to `~/.codeium/mcp_config.json`. OAuth-capable clients authorize on first use; invoke `readiness` after connecting.

```json
{
  "mcpServers": {
    "webs": {
      "serverUrl": "https://webs.creative-int.com/mcp"
    }
  }
}
```

### VS Code

Copy this Webs setup to `.vscode/mcp.json`. OAuth-capable clients authorize on first use; invoke `readiness` after connecting.

```json
{
  "servers": {
    "webs": {
      "type": "http",
      "url": "https://webs.creative-int.com/mcp"
    }
  }
}
```

### Any MCP client

Copy this Webs setup to `Streamable HTTP initialize`. OAuth-capable clients authorize on first use; invoke `readiness` after connecting.

```sh
curl --fail-with-body --silent --show-error 'https://webs.creative-int.com/mcp' \
  --request POST \
  --header 'Accept: application/json, text/event-stream' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $WEBS_API_TOKEN" \
  --data '{"id":1,"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{},"clientInfo":{"name":"webs-generic-client","version":"1.0.0"},"protocolVersion":"2025-06-18"}}'
```

### Any agent (npx skills)

Install the four Webs judgment skills. This does not connect MCP by itself; also use one of the client setup paths above unless your agent already has the Webs plugin.

```sh
npx skills add creative-int/webs-plugins
```

### Pi

Install the native seven-tool extension and the four Webs judgment skills. Authenticate with the Webs CLI, then ask Pi to invoke `readiness`; the extension reuses the selected CLI profile without printing its token.

```sh
pi install git:github.com/creative-int/webs-plugins
webs login --profile prod
```

### Claude Code (plugin)

Add the marketplace and install the Webs plugin. Invoke `readiness` and complete the Webs-owned OAuth flow when Claude prompts.

```sh
/plugin marketplace add creative-int/webs-plugins
/plugin install webs@webs
```

### Codex (plugin)

Add this repository as a Codex plugin marketplace, install Webs with `codex plugin add`, then invoke `readiness` and complete OAuth.

```sh
codex plugin marketplace add creative-int/webs-plugins
codex plugin add webs@webs
```

### Cursor (plugin)

Install Webs from the Cursor plugin marketplace, then invoke `readiness` and complete OAuth when Cursor prompts.

```sh
Cursor → Settings → Plugins → Add marketplace → creative-int/webs-plugins
```

### Quickstart: authenticate and verify

Every install path converges on the same remote MCP server and Webs-owned OAuth flow:

1. If you installed only with `npx skills`, also use one of the client setup paths above. Skills teach judgment; MCP or the native Pi extension provides the seven live tools.
2. Pi reads the selected Webs CLI profile from `~/.config/webs/config.json` (or `WEBS_CONFIG`). Run `webs login --profile <name>`, select it with `WEBS_PROFILE` when needed, and never paste or print its bearer token. Environment-only setups may use `WEBS_MCP_TOKEN` and `WEBS_MCP_URL`.
3. Invoke `readiness`. OAuth-capable clients open the Webs-owned authorization flow; generic clients can send a Connect bearer through `WEBS_API_TOKEN`. The intended connection requests `read search fetch save recall context ask watch run`.
4. Invoke `readiness` again after authentication. Treat the connection as ready only when Webs confirms auth, entitlement, granted scopes, and tool availability.
5. Exercise memory deliberately: call `context` with `{"task":"...","why":"..."}` only when prior memory may help; call `recall` with `{"query":"..."}`; then save a real source URL with `{"urls":["https://example.com"],"task":"...","why":"..."}`.

Use `ask` when you need a cited answer rather than retrieval results. Replace the example URL before saving.

<!-- AUTO-GENERATED:INSTALL END -->

To preview the available skills without installing:

```sh
npx skills add creative-int/webs-plugins --list
```

## How the companion fits together

| Piece | Responsibility |
| --- | --- |
| Plugin manifest | Connects Claude Code, Codex, or Cursor to the remote Webs MCP server and installs the four judgment skills. |
| `npx skills` | Installs only the portable judgment skills. Add the generic MCP configuration separately to call live tools. |
| MCP connection | Exposes the seven Webs tools from one remote endpoint. It does not add a local memory runtime. |
| OAuth | Runs through the client and Webs. The intended scope request is `read search fetch save recall context ask watch run`; credentials never belong in this repository. |
| `readiness` | Proves auth, entitlement, granted scopes, and tool availability. It is a tool protected by `read`, not an OAuth scope. |
| `context` | Returns a small task-affinity packet only when the agent explicitly requests one. No hooks or automatic injection are included. |
| `recall` / `ask` | `recall` returns inspectable memory results; `ask` returns a cited answer over memory. |
| `save` | Saves one to eight source URLs. Agent calls require `task` and `why`; content and selection inputs are not supported. |

## MCP surface

Webs exposes one remote Streamable HTTP MCP server. The surface is exactly seven
verbs:

| Tool | Protected by | Purpose |
| --- | --- | --- |
| `save` | `save` | Save one to eight source URLs. Agent deposits require task and why. |
| `recall` | `recall` | Hybrid semantic plus lexical retrieval over saved memory, with citations and scores. |
| `context` | `context` or `recall` | On-demand task-affinity packet for agents; never automatic injection. |
| `ask` | `ask` | Question over saved memory, with modes for saved-only, saved-memory, and fresh-then-saved. |
| `watch` | `watch` | Create or list monitors. |
| `run` | `run` | Durable research, compare, or monitor-snapshot runs with a poll contract. |
| `readiness` | `read` | Auth, entitlement, granted-scope, and tool-availability probe. |

## Included skills

- **`webs-memory`** — judgment rule for when to use Webs memory at all.
- **`webs-save`** — save durable source URLs with task and why.
- **`webs-recall-ask`** — choose recall versus ask versus fresh search.
- **`webs-context`** — request small on-demand context packets without hooks.

## Develop

```sh
pnpm install
pnpm generate
pnpm verify
```

`pnpm smoke` validates generated manifests and skill frontmatter. It does not
require a bearer token.

## License

[MIT](LICENSE) © creative-int
