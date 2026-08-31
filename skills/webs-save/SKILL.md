---
name: webs-save
description: This skill should be used when an agent needs to save durable source URLs, selected sources from an explicit Search saved run, or one supplied-content snapshot into Webs memory.
aliases:
  - save-memory
  - webs-save
author: Webs
---

# Webs save

Use Webs `save` to turn selected source URLs or one supplied-content snapshot
into memory that humans and agents can recall later.

Connect to the Webs MCP server at `https://webs.creative-int.com/mcp`.

## Save when

- A source-backed research conclusion has canonical URLs worth remembering.
- A public repo, provider, or product source documents a non-obvious truth that
  is likely to matter again.
- An explicit Search saved run contains a small set of source URLs worth
  selecting and preserving.
- The user explicitly asks to remember source URLs or a supplied snapshot in
  Webs and the agent can explain why it matters.

## Do not save

- Secrets, credentials, bearer tokens, private keys, or raw environment values.
- Unverified guesses or speculation.
- Noisy transient logs that will not help future recall.
- Material the user asked not to persist.
- Private or inaccessible URLs unless the user authorized the save and Webs can
  access the source.
- A Search query, provider payload, synthesized report, report URL, ranking, or
  private Search run-directory shape.
- More than eight URLs, or a save without both `task` and `why`.
- An automatic post-search save, automatic context injection, hidden hook, or
  invented eighth Webs verb.

## Required deposit shape

Every agent save carries intent:

- `task`: what work produced this memory.
- `why`: why this memory should matter later.
- exactly one input branch:
  - `urls`: one to eight HTTP(S) source URLs, or
  - `content`: one supplied snapshot, up to 200,000 characters.
- optional `title` and `sourceUrl` only for supplied content.
- optional `idempotencyKey`: use one when retrying the same save.
- optional `prompt`, `spaceId` or `space`, `tags`, and `note`.
- optional `via`: `mcp` or `extension`; MCP callers normally use `mcp`.

The task and why are not decoration. They become part of the thread that lets
future context packets find the right memory. Never combine `urls` and
`content`.

## Choose a path

```text
What should become memory?
+-- One to eight already-selected source URLs
|   +-- Native MCP available -> Path A: call the existing save tool.
|   `-- Shell-only caller -> call webs save directly with an inspectable plan.
+-- Sources from a Search saved run
|   +-- Explicit run id/path available -> Path B: export URLs, dry-run, inspect.
|   `-- Only "latest" or private run files available -> stop and request an explicit run.
`-- One supplied snapshot -> Path C: content with optional title/sourceUrl.
```

### Path A: native MCP source save

Confirm the smallest relevant set of one to eight URLs, then call the existing
Webs `save` tool once with `task`, `why`, and a stable `idempotencyKey`:

```json
{
  "urls": ["https://example.com/source"],
  "task": "Compare memory product positioning for Webs v1",
  "why": "This source explains why saved memory and fresh search need separate verbs",
  "idempotencyKey": "memory-positioning-v1",
  "via": "mcp"
}
```

### Path B: explicit Search run to shell save

Search owns saved-run parsing and URL selection. Name one run id or path, export
only its source URLs, and inspect Webs' credential-free dry-run:

```sh
search runs show <explicit-id-or-path> --urls --limit 8 |
  webs save - --limit 8 --dry-run --task "<task>" --why "<why>"
```

Only after the selected URLs, order, task, and why are correct should the caller
repeat the same explicit command without `--dry-run`. Never substitute
`latest`, parse Search's private run files, or pipe the query, report body,
provider payload, ranking, or report URL. A URL save is a fresh Webs fetch with
Webs-owned capture provenance; it does not import Search report lineage.

If the agent has native MCP after inspecting the explicit Search URL export, it
may use those selected URLs in Path A instead of invoking the shell save.

### Path C: supplied-content snapshot

Save one snapshot with `content` instead of `urls`. `sourceUrl` is optional and
names a public source for that snapshot; it does not establish multi-source
report lineage.

```json
{
  "content": "<supplied snapshot>",
  "title": "<optional title>",
  "sourceUrl": "https://example.com/source",
  "task": "Preserve the current source-backed decision",
  "why": "Future agents need the exact snapshot used for this decision",
  "idempotencyKey": "source-backed-decision-v1"
}
```

## Final checks

1. Confirm the material is durable and safe to persist.
2. Confirm exactly one input branch, within its eight-URL or 200,000-character
   bound.
3. Include non-empty `task` and `why` in plain language.
4. Prefer a stable idempotency key when retrying the same deposit.
5. Preserve the returned memory id or citation if the user needs a
   receipt.

## After saving

URL analysis can be asynchronous, so do not report it complete until the
returned status says so. Supplied content is a snapshot deposit, not evidence
that its claims or any wider report were independently verified. If auth or
entitlement is missing, call `readiness` or ask the user to authenticate the MCP
connection.
