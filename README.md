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
  <a href="https://webs.creative-int.com">webs.creative-int.com</a> |
  MCP: <code>https://webs.creative-int.com/mcp</code>
</p>

---

## Install

<!-- AUTO-GENERATED:INSTALL START -->

### Any MCP client (.mcp.json)

Add Webs as a Streamable HTTP MCP server. When your client prompts, complete auth; the bearer belongs in the client credential store, never in this repo.

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

Installs the Webs memory skill pack for skill-aware agents. The skills teach judgment; the live MCP endpoint remains the memory surface.

```sh
npx skills add creative-int/webs-plugins
```

### Claude Code

Add the marketplace, install the Webs plugin, then authenticate the MCP connection before the first memory call.

```sh
/plugin marketplace add creative-int/webs-plugins
/plugin install webs@webs
```

### Codex

Add this repo as a Codex plugin marketplace, install from /plugins, then authenticate the MCP connection.

```sh
codex plugin marketplace add creative-int/webs-plugins
```

### Cursor

Install Webs from the Cursor plugin marketplace, then authenticate the MCP connection.

```sh
Cursor -> Settings -> Plugins -> Add marketplace -> creative-int/webs-plugins
```

<!-- AUTO-GENERATED:INSTALL END -->

To preview the available skills without installing:

```sh
npx skills add creative-int/webs-plugins --list
```

## Quickstart: use saved memory by judgment

1. Add the MCP server with the generated `.mcp.json` block above, or install the
   plugin through Claude Code, Codex, or Cursor.
2. Authenticate when your client prompts. Bearer tokens belong in the client
   credential store or environment, never in this repo.
3. At the start of a task where saved context may matter, call `context` with
   a declared task and why.
4. Use `recall` for retrieval, `ask` for cited answers over memory, and `save`
   when a finding should be remembered later.
5. Use fresh search for drift-prone current facts, then save distilled durable
   findings back to Webs when they are worth keeping.

## MCP surface

Webs exposes one remote Streamable HTTP MCP server. The surface is exactly seven
verbs:

| Tool | Purpose |
| --- | --- |
| `save` | URL(s) or content into analyzed Webs memory. Agent deposits include task and why. |
| `recall` | Hybrid semantic plus lexical retrieval over saved memory, with citations and scores. |
| `context` | On-demand task-affinity packet for agents; never automatic injection. |
| `ask` | Question over saved memory, with modes for saved-only, saved-memory, and fresh-then-saved. |
| `watch` | Create or list monitors. |
| `run` | Durable research, compare, or monitor-snapshot runs with a poll contract. |
| `readiness` | Auth, entitlement, and scope probe. |

## Included skills

- **`webs-memory`** - judgment rule for when to use Webs memory at all.
- **`webs-save`** - save durable findings with task and why.
- **`webs-recall-ask`** - choose recall versus ask versus fresh search.
- **`webs-context`** - request small on-demand context packets without hooks.

## Develop

```sh
pnpm install
pnpm generate
pnpm verify
```

`pnpm smoke` validates generated manifests and skill frontmatter. It does not
require a bearer token.

## License

[MIT](LICENSE) (c) creative-int
