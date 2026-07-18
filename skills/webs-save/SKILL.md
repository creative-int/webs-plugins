---
name: webs-save
description: This skill should be used when an agent has one or more durable source URLs that should become Webs memory.
aliases:
  - save-memory
  - webs-save
author: Webs
---

# Webs save

Use Webs `save` to turn useful source URLs into memory that humans and agents
can recall later. The public MCP schema accepts URLs only.

Connect to the Webs MCP server at `https://webs.creative-int.com/mcp`.

## Save when

- A source-backed research conclusion has a canonical URL worth remembering.
- A public repo, provider, or product source documents a non-obvious truth that
  is likely to matter again.
- An agent found a useful web source during a task and can explain why it matters.
- The user explicitly asks to remember or save one or more source URLs in Webs.

## Do not save

- Secrets, credentials, bearer tokens, private keys, or raw environment values.
- Unverified guesses or speculation.
- Noisy transient logs that will not help future recall.
- Material the user asked not to persist.
- Private or inaccessible URLs unless the user authorized the save and Webs can
  access the source.
- Bare findings or prose without a source URL. Explain that the current public
  `save` tool is URL-only instead of inventing another input shape.

## Required deposit shape

Agent saves carry intent:

- `task`: what work produced this memory.
- `why`: why this memory should matter later.
- `urls`: one to eight source URLs.
- optional idempotency key: use one when retrying the same save.

The task and why are not decoration. They become part of the thread that lets
future context packets find the right memory.

## Workflow

1. Confirm the material is durable and safe to persist.
2. Choose the canonical source URL or the smallest relevant set of source URLs.
3. Include task and why in plain language.
4. Prefer idempotency when re-running automation.
5. After save, preserve the returned memory id or citation if the user needs a
   receipt.

## Example call

```json
{
  "urls": ["https://example.com/source"],
  "task": "Compare memory product positioning for Webs v1",
  "why": "This source explains why saved memory and fresh search need separate verbs"
}
```

## After saving

If the save result is asynchronous, do not pretend analysis is finished until
the returned status says so. If the save fails because auth or entitlement is
missing, call `readiness` or ask the user to authenticate the MCP connection.
