# 9. Frontend-only In-app Agent + Future Local-Agent Bridge

Date: 2026-04-26

## Status

Proposed

## Context

PR #11547 introduces an experimental in-browser agent (`ComfyAI`) that
lets users drive ComfyUI with natural language. It lives entirely in
`src/agent/` and runs in the SPA — prompt assembly, tool execution
(browser-side `run-js` + Comfy API calls), message storage, and IndexedDB
chat history all happen client-side. The LLM is reached directly from
the browser via the user's API key (OpenAI / OpenRouter / any
OpenAI-compatible gateway), with optional Comfy Cloud auth for the
small set of cloud nodes (Tripo / Tencent / Meshy / Gemini).

This frontend-only architecture is deliberate. It keeps the deployment
story trivial (no backend changes), keeps the user's API key out of
ComfyUI's backend, and works whether the backend is local or remote.
But it raises a coordination problem the moment users want their
**other agents** — Claude Code, a self-hosted CLI agent, a teammate's
agent on a different machine — to participate in the same conversation,
see the same workflow state, or take actions on the user's behalf.

The forces at play:

- **Privacy**: API keys must not leak to ComfyUI's backend or to other
  observers. The frontend-only model makes this trivially true today.
- **Source of truth for graph state**: the canonical workflow lives in
  LiteGraph's in-memory tree inside the SPA. Backend has the queue +
  history but doesn't track unsaved edits. Any other agent that wants
  current state must either read from the SPA or read a snapshot the
  SPA publishes.
- **Tool affordance**: the agent's `run_shell` tool currently executes
  in the browser page context (DOM, stores, fetch with same-origin
  cookies). A local agent has none of that — it would need either a
  separate REST surface or to drive the SPA remotely.
- **Identity**: the SPA can hold a Comfy Cloud token; a local agent is
  a separate principal and should hold its own credentials.
- **Versioning**: the moment we expose a wire format, breaking changes
  hurt. Whatever we ship first becomes the contract.

The question this ADR exists to answer: **how should a local agent
participate in the in-app agent's session, given the frontend-only
constraint we want to preserve?**

## Decision

**Short term (this PR and the next few): keep the agent strictly
frontend-only.** Do not add any backend session state, message
relaying, or local-agent bridge. The current architecture is small,
auditable, and removes whole categories of risk.

**Long term: when local-agent integration is taken on, prefer Option C
("opt-in publish bus with execution staying in the SPA") over the
alternatives.** The detailed shape:

1. Define a small JSON-RPC schema for "agent context" — current
   workflow id + serialized graph, last N messages, last K tool
   invocations, agent settings (model + base URL only, never key).
   Versioned from the start.
2. SPA exposes a "Share session" toggle in agent settings. When on,
   it publishes that snapshot to a configurable WS endpoint
   (default: `ws://localhost:7437/agent`). The user explicitly opts
   in per session.
3. Provide a tiny reference subscriber library that local agents use
   to consume. They get **read-only access by default**; getting
   write access (post a message back into the user's panel) requires
   the SPA to authorize via a one-time pairing code shown to the
   user.
4. **Tool execution stays in the SPA.** Local agents can _propose_
   actions ("run this run-js"); the SPA executes and streams the
   result back. The local agent is a peer that suggests, not an
   actor that mutates.

**Alternatives considered and rejected (for now):**

- **Option A — ComfyUI backend as session broker.** Push messages to
  the running ComfyUI server, local agents subscribe via WS or
  polling. Rejected because ComfyUI is meant to be largely stateless,
  adding session storage is scope creep, and it puts API keys / chat
  content in front of the backend (privacy regression).
- **Option B — browser extension or local sidecar daemon.** A
  companion daemon reads the SPA's IndexedDB via Chrome DevTools
  Protocol, or the SPA opens a localhost WS to it. Rejected as the
  default path because of the cross-platform packaging burden and
  because it doesn't help when the local agent runs on a different
  machine than the SPA.

**Comfy Cloud creds reuse (a related future work item):** when the
user is signed into Comfy Cloud (the `auth_token_comfy_org` flow we
already use for Tripo/Gemini), the agent could optionally route LLM
calls through a Comfy-managed inference endpoint instead of OpenAI
direct. This would gate naturally on the same auth as the cloud
nodes and simplifies onboarding for users who don't have their own
OpenAI/OpenRouter key. Out of scope here, but worth noting because
it interacts with the local-agent identity story above.

## Consequences

### Positive

- **No backend changes today.** PR #11547 lands without touching
  ComfyUI core. Reviewers don't need to evaluate session-state
  infrastructure they didn't ask for.
- **Privacy posture stays strong.** API keys + chat content stay in
  the user's browser; ComfyUI backend continues to see only what it
  always saw (queue prompts, file uploads).
- **Future local-agent path is clear** without committing to a
  protocol prematurely. When we build it, the SPA stays the
  source-of-truth + execution sandbox; the local agent is a peer that
  suggests. Mirrors how editors coexist with Claude Code, GitHub
  Copilot, etc.
- **Headroom for multi-subscriber.** Option C naturally supports
  agent + observer + log-tap subscribers with the same protocol —
  useful for future debugging tools.
- **Versioned wire format** means breaking changes are explicit.

### Negative

- **Local agents have no participation today.** Users who want their
  Claude Code session to see what they're doing in ComfyUI need to
  copy/paste workflow JSON manually.
- **When we do build the bridge, it's net-new infrastructure** — a
  WS server, a pairing flow, a versioning policy, a reference
  subscriber library. Not trivial.
- **Tool execution stays in the SPA** even after the bridge ships,
  which means a local agent on a different machine can't `run-js`
  against the user's session without the SPA being open. (We accept
  this as a privacy + simplicity tradeoff.)
- **The "Share session" toggle is yet another decision the user has
  to make**, with non-obvious risks. Mitigations: clear UX copy,
  default off, pairing-code requirement for write access.

## Notes

- The frontend-only constraint also drove several smaller decisions
  in the PR that are worth recording briefly:
  - Reasoning guardrails (`PROMISSORY_PATTERN`, `vetScript`,
    `verifyClaims`) live in the SPA in `src/agent/llm/session.ts`,
    not in a separate service. They survive prompt drift because
    they're code, not text.
  - Chat history is persisted via `useIDBKeyval` to IndexedDB. This
    is a per-browser-profile store; switching profiles or clearing
    site data wipes history. Acceptable for the experimental phase;
    if local-agent bridge ships, the snapshot the SPA publishes
    becomes another effective "external" history mechanism.
- The default LLM is `gpt-5.4` via OpenAI's official API. The
  settings panel exposes a base-URL field so users can target
  OpenRouter (`https://openrouter.ai/api/v1`) or any OpenAI-compatible
  gateway. This base-URL flexibility also makes Option C's "Comfy
  Cloud as inference endpoint" trivially achievable later — it's just
  another base-URL choice.
- Concrete near-term TODOs flagged by this PR's stress-testing,
  _not_ covered by this ADR but related:
  - Layer 3 of the reasoning guardrails (structured JSON answers
    with provenance) needs SDK plumbing to surface tool-call IDs
    alongside text. Currently deferred.
  - Verifier registry and shell-idiom blocklist are open
    registries; entries grow as new failure modes surface in real
    use.
