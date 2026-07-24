---
name: webs-memory
description: This skill should be used when an agent needs to decide whether to use Webs saved memory before answering, researching, or implementing.
aliases:
  - webs
  - memory
  - have-we-seen
author: Webs
---

# Webs memory

Webs is where the web becomes memory. It gives agents and humans one shared
saved-memory surface over the web: save, recall, context, ask, watch, run, and
readiness.

Connect to the Webs MCP server at `https://webs.creative-int.com/mcp`.

## Core law

Use Webs by judgment. Do not install or simulate automatic session-start memory
injection, hidden prompt wrappers, background hooks, or always-on context.
Agent context windows are scarce; `context` is a verb an agent chooses.

## Use when

- The user asks "have we seen this?", "what did we decide?", "from prior
  research", "recall", or similar saved-memory language.
- You are starting work on a topic, repo, product area, or decision that may
  have saved Webs memory.
- You are about to run fresh web research and a saved-memory backdrop might
  prevent rediscovery or reveal prior rulings.
- You are resuming a lane where earlier agent deposits, source packets, or
  product decisions could matter.
- You found a durable result that should be recallable by future humans or
  agents.

## Do not use when

- The task is fully self-contained in the current files and no prior memory is
  likely useful.
- The answer depends only on current public facts that may have changed and the
  user did not ask for saved memory.
- Calling memory would bloat context without changing the next action.
- The material contains secrets, raw tokens, credentials, or private data that
  should not become saved memory.

## Decision tree

```text
Does saved memory plausibly matter?
+-- No -> answer or work from local evidence.
+-- Yes, and the agent needs a small task packet -> call context.
+-- Yes, and the user wants an answer from memory -> call ask.
+-- Yes, and the agent needs exact retrieval -> call recall.
+-- The work surfaced durable source URLs -> call save with task and why.
```

## Tool split

| Need | Webs tool |
| --- | --- |
| Small task-affinity packet | `context` |
| Question over saved memory | `ask` |
| Retrieval by query or exact id | `recall` |
| Durable memory deposit | `save` |
| Standing monitor | `watch` |
| Durable research or compare run | `run` |
| Auth and scope probe | `readiness` |

The live surface is exactly these seven tools. `readiness` is protected by the
`read` OAuth scope; it is not itself an OAuth scope.

Use fresh public-web search for drift-prone current facts. When fresh research
produces a durable conclusion, save its supporting source URL or URLs with a
clear task and why.

## Output posture

When Webs memory shaped your answer, cite the memory result or say what was
missing. Treat missing memory as useful evidence, not failure: say that saved
memory did not cover the question, then use the appropriate fresh evidence loop.
