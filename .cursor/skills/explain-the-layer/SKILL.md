---
name: explain-the-layer
description: Explains the problem underneath code that was written, why each tool, construct, technique, and term fits, and the extreme input or state where that choice breaks. Use when the user asks to explain what was written, why a library or technique was chosen, to study the layer under the work, to find limits or failure edges, or says jelaskan, mengapa, alasan, lapisan di bawah, batas ekstrim, limitasi, rusak, or why this approach.
---

# The Layer Under the Work

Explain the decisions that change the design, starting from the problem that existed before the code was written. The reader is an engineer who wants to predict the next similar decision.

Write the explanation in the language the user is using. Keep library names, identifiers, SQL, and invariant ids in their original form.

## When

Use this skill when the user asks why a tool, construct, technique, or term was used in code just written or currently in front of them.

Do not use it to hunt bugs outside the decision being discussed, to restate the diff, or to summarize a file.

When the user points at one symbol, explain only that symbol's layer.

## Before writing

1. Read the code in question. When the repo has them, also read `AGENTS.md`, the ADR, and the contract that binds the decision.
2. Group the change into decisions. One decision is one problem that would produce a different solution if answered differently.
3. Skip boilerplate that does not change the design, unless the user asks about it.

## One layer

Go one layer under the work. Stop when the reader could predict a similar decision.

On a follow-up, go one layer under the previous answer. Do not jump to theory that would not change this decision.

## Answer shape

Open with one or two sentences: the problem under the whole change. Then each decision:

### [tool, construct, technique, or term]

- **Problem**: the failure that remains if this code does not exist. Name who is affected. When the repo defines it, name the invariant or ADR id.
- **Choice**: the symbol, library, or technique, with its file path.
- **Why it fits**: the property of this choice that closes the problem, plus one concrete event that is now rejected.
- **Breaks**: one extreme edge, as defined below.
- **Left open**: the work this decision deliberately does not finish.

Explain a term only as far as it names the problem. Do not write a glossary entry.

Mention another option only when that option is a reasonable one and still leaves the problem open. Name the problem that stays open.

## Assume it breaks

For every decision, assume the caller, the layer above, or the data will push this choice until its guarantee stops.

The extreme edge is the input, state, or sequence at that point. Pick one: the edge most able to invalidate the decision. Do not list every way it can fail.

For code that already exists, say what happens at that edge: rejected, stored in a broken state, or allowed through. Point at the file or test. Behavior that is not visible in the code is not established.

For a concept that is not implemented yet, the extreme edge is pressure that is still open. Do not claim the code already rejects it.

**Left open** is work deliberately deferred. **Breaks** is the edge where the guarantee stops.

## Anchor

Attach every claim to code, a test, an invariant, or an ADR that exists. Do not invent a reason the code does not carry out. When the code and the docs disagree, say both.

## Sample answer

### WebSocket `Pool` from `@neondatabase/serverless`

- **Problem**: a calibration batch and its audit log must commit or roll back together (Invariant T6). On serverless, a direct TCP connection to Postgres exhausts connection slots when many instances start at once (Invariant T4).
- **Choice**: `createDb` in `packages/db/src/client.ts` uses a WebSocket `Pool` against a host that contains `-pooler`.
- **Why it fits**: the pooler holds an interactive transaction, so two `INSERT`s share one commit boundary. A query through the HTTP driver finishes in a single request, so those two inserts do not share a transaction and T6 stays open.
- **Breaks**: a `DATABASE_URL` without `-pooler` is still accepted by `createDb`. The `Pool` opens a direct connection, and the code does not reject the TCP-slot exhaustion T4 exists to prevent.
- **Left open**: the driver choice does not define the tables, and it does not add the Hono routes.

## Do not

- Restate the diff line by line.
- Praise the choice.
- Explain syntax that is already visible in the code.
- Descend every layer down to the operating system in one answer.
- List every way something can fail. One extreme edge per decision.
