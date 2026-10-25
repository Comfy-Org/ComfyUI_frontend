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

Preserve the workflow and its complete target together through authentication,
workspace switches and deployment reloads. Resolve workspace/environment first,
then fetch through the authenticated API. A late response cannot open after the
identity, workspace or requested environment changes.

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

Record-only historical saves need to be saved into the Workflows sidebar before
they can open as normal editable documents. This conservative fallback can also
refuse an update racing the metadata/content reads; reopening from the sidebar
or retrying after synchronization is safe. A future server-owned filename or
record-ID association can replace the candidate-path verification without
changing the URL contract.

Startup coordination lives with the [app URL loaders](../../src/composables/useSavedWorkflowUrlLoader.ts).
[Navigation](../../src/platform/navigation/savedWorkflowLink.ts) validates the query,
and an [authenticated read adapter](../../src/services/savedWorkflowService.ts)
verifies the saved record and userdata. These are navigation and integration
responsibilities rather than workflow-format domain logic.
