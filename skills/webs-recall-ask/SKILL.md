---
name: webs-recall-ask
description: This skill should be used when an agent needs to retrieve from Webs memory or answer a question over saved memory.
aliases:
  - webs-recall
  - webs-ask
  - ask-memory
author: Webs
---

# Webs recall and ask

Use `recall` to retrieve saved memories. Use `ask` to answer questions over
saved memory with citations.

Connect to the Webs MCP server at `https://webs.creative-int.com/mcp`.

## Choose the verb

```text
What does the user need?
+-- Exact saved web, query results, excerpts, or scores -> recall.
+-- Natural-language answer over saved memory -> ask.
+-- Small task packet for the current agent run -> context.
+-- Current public facts -> fresh search first, then optionally ask/save.
```

## Recall

Use `recall` when you need retrieval results rather than an answer:

- "Find saved items about X."
- "Have we seen this source before?"
- "Show the memory for this web id."
- "Give me citations/excerpts/scores I can inspect."

Carry scores and provenance honestly. A low score is a weak match, not proof that
the topic is absent.

## Ask modes

- `saved_only`: answer only from saved Webs memory. If memory is missing, say so.
- `saved_memory`: use saved memory as the primary source and name stale or
  missing gaps.
- `fresh_then_saved`: gather fresh public evidence first, then reconcile it with
  saved memory.

Use `fresh_then_saved` when current facts may have changed but prior Webs memory
is still relevant background.

## Fresh-search boundary

Saved memory is not proof of current truth for prices, laws, schedules, product
availability, sports, news, provider status, or active company facts. For those,
refresh with the owning search/evidence loop, then use Webs to reconcile or save
durable conclusions.

## Answer shape

When using Webs:

1. Cite the saved memory or explain that it was missing.
2. Separate saved-memory evidence from fresh evidence.
3. Name uncertainty rather than smoothing it away.
4. Save durable new findings if they should be remembered later.

## Common mistake

Do not turn every recall result into a confident answer. Sometimes the right
answer is: "Webs has adjacent memory, but not enough to answer this without
fresh research."
