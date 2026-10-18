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
+-- ask returned answerability.status "unsupported" -> see "When memory
    doesn't hold it": escalate once or report the gap. Never retry.
```

## Recall

Use `recall` when you need retrieval results rather than an answer:

- "Find saved items about X."
- "Have we seen this source before?"
- "Show the memory for this web id."
- "Give me citations/excerpts/scores I can inspect."

Carry scores and provenance honestly. A low score is a weak match, not proof that
the topic is absent.

`recall` accepts `query`, exact `webId`, `spaceId` or `space`, bounded `limit`,
`includeMarkdown` for exact-web retrieval, optional ISO `since`, and optional
feedback. Query and web ID are optional individually; provide the narrowest
input that matches the task.

## Ask modes

- `saved_only`: answer only from saved Webs memory. If memory is missing, say so.
- `saved_memory`: use saved memory as the primary source and name stale or
  missing gaps.
- `fresh_then_saved`: gather fresh public evidence first, then reconcile it with
  saved memory.

Use `fresh_then_saved` when current facts may have changed but prior Webs memory
is still relevant background.

`ask` requires `question` and `mode`. Its optional `scope` accepts `spaceId`,
`space`, `webIds`, or `watchIds`; optional `task`, `why`, `citationStyle`
(`inline`, `footnote`, or `json`), and feedback preserve intent and output
shape.

## When memory doesn't hold it

`ask` can abstain honestly. When its result carries
`answerability.status: "unsupported"`, Webs judged that the saved evidence does
not directly support an answer: `citations` is empty, nothing was synthesized,
and `escalation.action` offers a `fresh_then_saved` ask. That result is a
finished answer, not an error.

- Do not retry. Re-asking the same question, rephrasing it, or switching
  between `saved_only` and `saved_memory` to fish for a cited answer turns
  honest abstention into a loop.
- If current public facts are in scope (prices, releases, laws, schedules,
  provider status, news), escalate once: call `ask` with
  `escalation.action.params` as given. Whatever that call returns is final. If
  it is `unsupported` too, neither fresh nor saved evidence supports an answer;
  say so.
- Otherwise, report that saved Webs memory doesn't hold the answer. Name any
  adjacent memory `recall` showed, and offer to research the question or save a
  source that answers it.

`supported` means the evidence directly supports the answer. `skipped` means
the check did not run, so treat the answer as ordinary cited synthesis. An
absent `answerability` field means the check was not active for that call.

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
4. Save the supporting source URL or URLs when new evidence should be remembered.

## Common mistake

Do not turn every recall result into a confident answer. Sometimes the right
answer is: "Webs has adjacent memory, but not enough to answer this without
fresh research."
