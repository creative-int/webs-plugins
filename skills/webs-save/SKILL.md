---
name: webs-save
description: This skill should be used when an agent has a durable web finding, source, decision, or research result that should become Webs memory.
aliases:
  - save-memory
  - webs-save
author: Webs
---

# Webs save

Use Webs `save` to turn useful web material or distilled findings into memory
that humans and agents can recall later.

Connect to the Webs MCP server at `https://webs.creative-int.com/mcp`.

## Save when

- A source-backed research conclusion should be remembered.
- A repo, provider, or product truth is non-obvious and likely to matter again.
- An agent discovered a useful fact during a task and can explain why it matters.
- A search or source packet has been distilled into something reusable.
- The user explicitly asks to remember, save, deposit, or add a finding to Webs.

## Do not save

- Secrets, credentials, bearer tokens, private keys, or raw environment values.
- Unverified guesses or speculation.
- Noisy transient logs that will not help future recall.
- Material the user asked not to persist.
- Full private documents when a citation, summary, or safer excerpt is enough.

## Required deposit shape

Agent saves carry intent:

- `task`: what work produced this memory.
- `why`: why this memory should matter later.
- source or content: URL(s), selected content, or distilled text.
- optional idempotency key: use one when retrying the same save.

The task and why are not decoration. They become part of the thread that lets
future context packets find the right memory.

## Workflow

1. Confirm the material is durable and safe to persist.
2. Keep the saved content narrow: the source, excerpt, or distilled conclusion.
3. Include task and why in plain language.
4. Prefer idempotency when re-running automation.
5. After save, preserve the returned memory id or citation if the user needs a
   receipt.

## Example intent

```text
task: Compare memory product positioning for Webs v1
why: This source explains why saved memory and fresh search need separate verbs
```

## After saving

If the save result is asynchronous, do not pretend analysis is finished until
the returned status says so. If the save fails because auth or entitlement is
missing, call `readiness` or ask the user to authenticate the MCP connection.
