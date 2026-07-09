# Webs plugins - agent guide

Public distribution repo for Webs: generated plugin manifests for Cursor,
Codex, and Claude Code, `.mcp.json`, MCP Registry `server.json`, and the Webs
memory skill pack. The hero is inbound MCP plus portable judgment guidance:
external agents connect to Webs' remote endpoint and call the seven memory verbs
by judgment.

## The one rule: generate, don't hand-edit

`webs.config.ts` is the single source of truth. Every manifest, `.mcp.json`,
`server.json`, and the README install block are emitted from it by
`tooling/generate.ts`. Edit the config, then:

```sh
pnpm generate
pnpm verify
```

Never hand-edit the generated files (`.mcp.json`, `.claude-plugin/*`,
`.codex-plugin/*`, `.cursor-plugin/*`, `server.json`, the README
`AUTO-GENERATED` block). CI runs `check:generated` and fails on drift.

## Scope

- v0: central remote MCP metadata, three client manifests, `.mcp.json`,
  `server.json`, and four portable Webs memory skills.
- Live origin: `https://webs.creative-int.com/mcp`.
- The context verb is on demand only. Do not add automatic context injection,
  session hooks, or hidden prompt wrappers.

CLAUDE.md is a symlink to this file.

## Platform posture

tooling - Webs plugins repo; no product runtime surface.

## Companion plugin profile

This repo intentionally uses the `agent-plugin-companion` profile rather than
the full app-family turborepo profile. It is a public agent-facing distribution
repo for Webs, so it owns generated plugin manifests, skills, MCP metadata, and
install documentation - not product runtime surfaces.

Required root contract for this profile:

- `AGENTS.md` plus `CLAUDE.md -> AGENTS.md`
- `README.md`, `LICENSE`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`,
  `.nvmrc`, `.gitignore`, `.github/workflows/verify.yml`
- canonical config at `webs.config.ts`
- generator and smoke tooling under `tooling/`
- distributed skills under `skills/`
- generated client adapters: `.mcp.json`, `server.json`, `.claude-plugin/`,
  `.codex-plugin/`, `.cursor-plugin/`

Intentional omissions: `apps/`, `packages/`, `TESTING.md`, `knip.json`,
`codecov.yml`, `biome.json`, `turbo.json`, `pnpm-workspace.yaml`, and `.npmrc`
until the plugin pack grows into a workspace or needs private GitHub Packages.
