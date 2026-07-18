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

### Any MCP client (generic .mcp.json)

Add Webs as a remote Streamable HTTP server, then invoke `readiness` to begin client-owned OAuth. Never paste a bearer into this repository.

```json
{
	"mcpServers": {
		"webs": {
			"url": "https://webs.creative-int.com/mcp",
			"transport": "streamable-http"
		}
	}
}
```

### Any agent (npx skills)

Install the four Webs judgment skills. This does not connect MCP by itself; also use the generic MCP configuration above unless your agent already has the Webs plugin.

```sh
npx skills add creative-int/webs-plugins
```

### Claude Code

Add the marketplace and install the Webs plugin. Invoke `readiness` and complete the Webs-owned OAuth flow when Claude prompts.

```sh
/plugin marketplace add creative-int/webs-plugins
/plugin install webs@webs
```

### Codex

Add this repository as a Codex plugin marketplace, install Webs from `/plugins`, then invoke `readiness` and complete OAuth.

```sh
codex plugin marketplace add creative-int/webs-plugins
```

### Cursor

Install Webs from the Cursor plugin marketplace, then invoke `readiness` and complete OAuth when Cursor prompts.

```sh
Cursor → Settings → Plugins → Add marketplace → creative-int/webs-plugins
```

### Quickstart: authenticate and verify

Every install path converges on the same remote MCP server and Webs-owned OAuth flow:

1. If you installed only with `npx skills`, also add the generic MCP configuration above. Skills teach judgment; MCP provides the seven live tools.
2. Invoke `readiness`. Complete OAuth in the client-owned browser or credential flow when prompted. The intended connection requests `read search fetch save recall context ask watch run`; never copy a bearer into this repository.
3. Invoke `readiness` again. Treat the connection as ready only when Webs confirms auth, entitlement, granted scopes, and tool availability.
4. Exercise memory deliberately: call `context` with `{"task":"...","why":"..."}` only when prior memory may help; call `recall` with `{"query":"..."}`; then save a real source URL with `{"urls":["https://example.com"],"task":"...","why":"..."}`.

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
