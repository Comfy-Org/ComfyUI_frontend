# ADR-DEFAULT-WORKFLOW-0050: Core Serves the Default Workflow

Date: 2026-10-28

## Status

Proposed

## Context

The workflow a new user lands on has lived in frontend TypeScript
(`src/scripts/defaultGraph.ts`) since it existed. Changing it therefore costs a
frontend release plus a core version bump, which is why it sat on Stable
Diffusion 1.5 for years before ComfyUI_frontend#12804 moved it to Z-Image Turbo.

Two things want that coupling gone:

- Core wants to refresh the default on a cadence measured in weeks (the
  community-submitted showcase workflow), which a release train cannot serve.
- Each distribution wants a different default. Cloud does not want a workflow
  that assumes a local GPU; desktop would rather open one whose model it
  already bundles; Apple Silicon wants something that runs there.

ComfyUI#16956 (CORE-340) landed the backend half: `default_workflow.json` plus
`GET /default_workflow` (and `/api/default_workflow`), documented in
`openapi.yaml` and served with `Cache-Control: no-cache` so an updated file is
not heuristically reused from cache. The file is a byte-for-byte copy of the
frontend's current `prodDefaultGraph`. Cloud implements the same endpoint.

This ADR covers the frontend half (FE-1178), the last of the four steps planned
for this change. Decoupling the e2e suites from the default workflow was the
other, and it already shipped as the `VITE_USE_LEGACY_DEFAULT_GRAPH` build
variable.

The frontend constraint that shapes the design: all three places that need a
default are synchronous. `loadGraphData` falls back to it when handed invalid
data, `createNewWorkflow` seeds a new tab with it, and `loadDefaultWorkflow`
loads it on the last tab closing. Making the default async would push
`await` into a store getter and a tab-creation path that are not async today.

## Decision

The frontend fetches the default workflow from the backend once per page load
and keeps the bundled graph as the fallback.

- `defaultWorkflowService` owns resolution. `initDefaultWorkflow()` performs
  the request at most once; `getDefaultWorkflow()` returns the fetched workflow
  if there is one and the bundled `defaultGraph` otherwise.
- `ComfyApp.setup` starts the request before `syncWorkflows` and awaits it as
  its last step, so the request overlaps the rest of boot rather than adding to
  it. The startup workflow load runs after `setup` returns, so a resolved
  default is already in place by the time anything reads it.
- The three call sites stay synchronous: they call `getDefaultWorkflow()` where
  they used to read the `defaultGraph` import. Each already cloned before
  mutating, which a shared module-level object also required.
- `initDefaultWorkflow()` never rejects. A 404 (any backend older than
  ComfyUI#16956), a server error, a body that is not JSON, a body that fails
  `validateComfyWorkflow`, and a failed request all resolve to the bundled
  graph. Only a 404 is silent, because that is simply what an older backend
  says. The rest go through `reportError` with a distinct `errorType`, so a
  core that starts serving a workflow this schema rejects is visible.
- The default is a template, not a document, so `getDefaultWorkflow()` never
  returns a workflow `id`. The schema and the route's contract both permit one,
  and core serves the selected file as-is, so a replacement default could ship
  with an exported UUID. `ensureWorkflowId` preserves a valid id on purpose, so
  without this every `createTemporary()` would copy that one id into a
  different new workflow, leaving new tabs sharing a root graph id and
  `openWorkflowPathForGraph` unable to attribute a polled run to a single tab.
  The strip lives at that one read, covering the bundled fallback as well as a
  served workflow; a second guard at the creation site would be unreachable and
  only testable through a state the service cannot produce. Explicitly supplied
  or opened workflows keep their ids as before.
- The whole prefetch is bounded, body read included, not just the request.
  `fetchApi` clears its timeout once the response arrives, so a backend that
  sends headers and then stalls mid-body would otherwise leave `res.json()`
  pending and hold the editor closed for as long as the socket lives. On expiry
  the bundled graph is used and `setup` continues.
- Builds with `VITE_USE_LEGACY_DEFAULT_GRAPH=true` skip the request entirely.
  Those builds run against a real core, so fetching would serve the current
  default and undo the test pinning that hundreds of specs depend on. The flag
  is read at call time rather than at module load; Vite inlines
  `import.meta.env` the same either way, and a call-time read is testable
  without resetting the module registry.

A prefetch was chosen over a fetch per use because the call sites are
synchronous and because core sends `Cache-Control: no-cache` — a reload is the
intended way to pick up a changed default, not a mid-session swap.

Alternatives considered and rejected:

- Making the default async end to end. Correct in the abstract, but it turns a
  store getter and a tab-creation path async for a value that is known before
  the editor opens.
- Mocking the route in the e2e suites instead of skipping the fetch. The
  pinning already exists and works; adding a route mock to every spec file
  would be a larger change than the feature.
- Serving the default from the workflow templates index, which the frontend
  already fetches. It is a different contract with a different owner, and core
  wants `server.py` to be the one-line edit.

## Consequences

### Positive

- Core changes the default workflow in a one-line `server.py` edit, with no
  frontend release and no core version bump. A CMS can replace the file later
  without the frontend noticing.
- Cloud, desktop and platform-specific builds can each serve their own default
  from their own backend.
- No user-visible change on this commit: core serves a byte-for-byte copy of
  the workflow the frontend already bundles, so the decoupling ships before any
  content change does.
- Every backend older than the route keeps working, silently.

### Negative

- Boot awaits one more request. It is started early and awaited last, so it
  adds nothing unless it outlasts the rest of `setup`. A slow backend can still
  delay the editor opening by up to the prefetch bound.
- The default is now a network-dependent value, so two users on the same
  frontend build can land on different workflows. That is the point, but it
  makes "what did the user see" unanswerable from the frontend version alone.
- A core that serves a workflow this frontend's schema rejects falls back
  without telling the user. The fallback is reported, so it is visible in
  telemetry rather than only in a console, but nothing tells core at publish
  time that its workflow would be refused. A server-side contract test against
  this schema is the follow-up.
- E2E builds do not exercise the fetch path at all, by construction. The unit
  tests cover it; no browser test does.
- `defaultGraph` remains exported and bundled, so the workflow is still shipped
  in the frontend bundle even once core always serves one. It cannot be dropped
  while it is the fallback.

## Notes

The service and its fallback matrix are covered in
`src/platform/workflow/core/services/defaultWorkflowService.test.ts`.

Backend half: ComfyUI#16956. Tracked as FE-1178 (frontend) and CORE-340
(core, done). The community-submission program that motivates the cadence is
still in design and is not part of this decision.
