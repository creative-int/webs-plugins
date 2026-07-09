---
name: webs-context
description: This skill should be used when an agent needs a small cited Webs context packet for the current task.
aliases:
  - agent-context
  - context-packet
author: Webs
---

# Webs context

`context` returns a small task-affinity packet from saved Webs memory: relevant
threads, excerpts, citations, and budget accounting. It is designed for agents
who know their current task and why saved memory may help.

Connect to the Webs MCP server at `https://webs.creative-int.com/mcp`.

## Non-negotiable law

Call `context` by judgment only. Never add automatic session-start hooks,
background injection, hidden system-prompt expansion, or mandatory preflight
calls. Context windows are sacred.

## Use when

- Starting a task on a topic that may have prior saved memory.
- Before fresh web research, to check whether Webs already has relevant threads
  or source packets.
- Resuming a recurring product, repo, issue, or research lane.
- The user asks from memory language: "have we seen", "what did we decide",
  "recall prior context", or "use Webs memory."

## Do not use when

- The task is tiny or entirely local.
- The output would not change your next action.
- The user asked for current public facts and saved memory is unlikely to help.
- You would need to send secrets or sensitive private content as the task text.

## Input shape

Provide:

- `task`: the concrete work being done.
- `why`: why saved memory could help this task.
- optional text: the prompt, issue, source title, or other task clues.
- optional scope filters when the client exposes them.

Good task and why fields are short but specific. Avoid generic fields such as
`task: research` or `why: context`.

## Use the packet

1. Read citations and excerpts before relying on a result.
2. Carry uncertainty forward when scores or provenance are weak.
3. If the packet is stale or missing, say so and use fresh evidence.
4. If fresh work produces a durable conclusion, save it with task and why.

## Example

```text
task: Prepare a Webs v1 lane closeout
why: Prior Webs V1 rulings may define the context verb and no-auto-injection law
text: context verb agent memory recall saved packets
```

## Failure handling

If `context` fails because auth, entitlement, or scope is missing, call
`readiness` when available and tell the user which connection state is missing.
Do not silently proceed as if Webs memory was empty.
