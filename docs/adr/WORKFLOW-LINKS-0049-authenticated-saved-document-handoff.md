# ADR-WORKFLOW-LINKS-0049: Authenticated saved-document handoff

Date: 2026-10-24

## Status

Proposed

## Context

A Run on Cloud handoff needs to open a private saved workflow in the chosen
workspace and environment. A graph UUID in the fragment identifies tab state,
while a public share URL publishes a separate snapshot. Neither identifies the
private saved document. Normal sidebar documents are userdata files; the
versioned workflow record exposes a name and content but no authoritative
userdata filename.

## Decision

Use `?workflow=<saved-workflow UUID>` for an authenticated private record.
An optional `workspace=<id>` scopes navigation. Custom environments retain the
existing `deployment=<id>` contract; `environment=standard` explicitly selects
standard Cloud for this browser. The two environment selectors are mutually
exclusive. Changing the browser selection never stops or deletes a deployment.

Link producers require the literal `private_workflow_links_enabled: true` from
`/api/features` before emitting a private link. Operators advertise it after the
matching frontend release and disable advertisement before rolling that release
back, as specified by the [merged Cloud integration contract](https://github.com/Comfy-Org/cloud/blob/89174e97cec8a1d09687224e38d3cd58f296f783/docs/systems/06-frontend-cloud-integration.md).
The browser loader verifies identity, workspace, environment and saved-document
access when a link is opened.

Deployment links switch to the named workspace once, preserving the target for
the reload; the switch marker prevents another reload when that switch did not
land. In the named workspace, consumed parameters are stripped before selecting
the browser environment and reloading. Signed-out redirects preserve the intent,
while API-key sessions cannot select a browser environment. Link selection waits
for bounded boot deployment discovery so an existing selection can be retained;
a listing refusal still lets the selection API return its authoritative answer.
An explicit standard link records the browser's own selection, including when the
workspace currently has no default.

Preserve the workflow and its complete target together through authentication,
workspace switches and deployment reloads. Resolve workspace/environment first,
then fetch through the authenticated API. A late response cannot open after the
identity, workspace or requested environment changes.

A new workflow or changed explicit target replaces the previous intent; redirects
that continue the same intent retain it. Only a deferred startup attempt arms a
readiness retry. An unchanged plain link may survive a late deployment listing
for replay after reload; sign-out, workspace changes and replaced links cannot
resume the old request or consume a newer intent.

Open through the normal workflow service after verifying the record's candidate
userdata path and exact saved content. This preserves the saved document identity,
existing dirty drafts and other open tabs. Until the server supplies a durable
record-to-file association, missing or conflicting userdata fails explicitly;
it does not silently create a copy or choose a same-named file.

## Alternatives

- Public sharing changes privacy and requires a separate user choice.
- Graph fragments cannot distinguish saved copies with the same graph UUID.
- Opening record JSON as a temporary document loses normal saved-file identity.
- Trusting the record name without content verification can open unrelated data.
- A new environment API duplicates the existing authenticated browser-selection
  service, which already supports selecting standard Cloud.

## Consequences

The ingest TypeScript types and Zod schemas are generated from the merged Cloud
OpenAPI at `89174e97cec8a1d09687224e38d3cd58f296f783`, using the Cloud workflow's
`openapi-project -fe` projection, pinned `@hey-api/openapi-ts` 0.97.3 and the
repository formatter. The generated package is kept reproducible as a whole,
including its public index.

Record-only historical saves need to be saved into the Workflows sidebar before
they can open as normal editable documents. This conservative fallback can also
refuse an update racing the metadata/content reads; reopening from the sidebar
or retrying after synchronization is safe. A future server-owned filename or
record-ID association can replace the candidate-path verification without
changing the URL contract.

If a request is revoked after configuring the shared canvas, discard that canvas
only while its graph state and document selection still belong to the load.
Detach the selection before clearing, retain the previous tab's dirty draft and
undo history, and reopen it through normal navigation. While loading, draft
persistence reads the selected document's frozen state rather than the incoming
canvas. Revoked requests cannot repaint content from the old context.

Cross-domain cancellation coverage lives in
[`src/integrationTests/workflowHandoffPersistence.test.ts`](../../src/integrationTests/workflowHandoffPersistence.test.ts).
The domain catalog's inventory contract lets this test compose application,
workflow, storage and workspace boundaries without granting those imports to a
production domain.

Startup coordination lives with the [app URL loaders](../../src/composables/useSavedWorkflowUrlLoader.ts).
[Navigation](../../src/platform/navigation/savedWorkflowLink.ts) validates the query,
and an [authenticated read adapter](../../src/services/savedWorkflowService.ts)
verifies the saved record and userdata. These are navigation and integration
responsibilities rather than workflow-format domain logic.
