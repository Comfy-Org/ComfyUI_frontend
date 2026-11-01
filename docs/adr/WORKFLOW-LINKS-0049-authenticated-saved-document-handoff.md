# ADR-WORKFLOW-LINKS-0049: Authenticated saved-document handoff

Date: 2026-10-30

## Status

Proposed

## Context

A Run on Cloud handoff must edit the exact private saved userdata document.
A workflow record UUID, graph UUID, matching filename or equal content cannot
establish that identity. Paths can change through rename and can be reused
after deletion. Cached documents and persisted drafts can outlive either change.

## Decision

Use `?savedFile=<userdata UUID>`, with the existing optional `workspace`,
`deployment` or `environment=standard` target. Mixed `savedFile` and legacy
`workflow` parameters are invalid. Legacy record links report unavailable and
require a newly generated link; they never resolve by name or content.

The authenticated `/api/userdata-files/{id}` endpoint supplies one exact
owner/workspace/UUID row snapshot: canonical ID, actual workflow path, original
UTF-8 content, modification time and byte size. The frontend validates that
received snapshot and hydrates the normal saved document directly from its bytes.
It never follows resolution with an unguarded path read or creates a temporary
copy. A narrow runtime decoder represents this explicit new contract until its
producer types are published. Existing generated packages remain the exact
landed main version and are not regenerated from an unpublished producer branch.

Carry the userdata UUID and authenticated owner/workspace through saved workflow
objects and draft metadata. Graph IDs remain independent. Same-ID dirty documents
retain their change tracker and undo state. A loaded/open/dirty path collision or
persisted draft with unknown or different identity is preserved and refuses the
link. Equal content never upgrades unknown identity. A same-ID server rename
moves the document and draft aliases together; a conflicting destination remains
untouched. Identified draft restoration resolves the UUID again through the same
snapshot and normal service, including after a server rename.

Subsequent path reads, saves, deletes and moves use the mandatory-ID namespace
`/api/userdata-files/{id}/path/{file}` (with `/move/{dest}` for rename). Cloud
checks that UUID atomically with owner/workspace/path and returns 412 on stale
identity without touching a replacement or creating an upsert. The API adapter
selects this route when its caller supplies `expected_id`; it never relies on
an optional query guard that an older backend could ignore. A rolled-back
backend returns 404 for the new route before any mutation. A deliberate Save
As creates a fresh identity. Missing metadata on local or older servers preserves
ordinary path-based operations, but cannot certify a private saved-file link.

Preserve the saved-file identity and complete target together across sign-in,
workspace switches and environment reloads. A changed identity or explicit target
replaces the preceding intent. Repeated/bare values remain invalid through
redirect preservation. Deployment links switch workspace once, then remove
consumed selection parameters before choosing the browser environment. Explicit
standard selection uses that browser's own pick. API-key sessions cannot select
a browser environment. An unchanged plain link can survive late deployment
listing for replay; replaced links and revoked identity cannot resume it.

Loading preserves the existing context/current/post-await checks. Read responses
cannot hydrate or paint after owner/workspace/environment revocation. Revoked
canvas cleanup requires the exact activated document and captured graph state;
it detaches the selection before clearing and restores the retained dirty tab
through ordinary navigation. Persistence reads the frozen selected document
while graph loading is in progress. Saved-baseline restoration wraps dirty
workflow activation so the dirty graph cannot become its own clean baseline.

The literal `private_saved_file_links_enabled: true` fact from `/api/features`
is a CLI publication gate only. It defaults off in Cloud, is advertised only
after compatible backend/frontend rollout, and is disabled before rollback.
The browser has no capability kill switch. This change does not deploy or enable
the capability. Old servers fail private snapshot reads safely, without a path
fallback, repeated upload or substitution of the old record-link capability.

## Alternatives

Public share links publish a separate snapshot and require a different privacy
choice. Graph fragments identify tab state rather than saved files. Resolving a
record name and comparing JSON cannot distinguish equal-content replacement
files, and a preflight comparison cannot protect a later read or mutation.
Temporary documents lose saved identity, drafts and normal save behavior.

## Consequences

The producer and consumer rollout must precede capability advertisement. Historical
record links must be regenerated. Unknown pre-upgrade dirty state may require
manual sidebar recovery; preserving it costs an explicit refusal instead of
risking silent association or data loss. UUID identity adds scope metadata to
normal documents and drafts, while local ComfyUI remains path compatible.

Navigation parsing and preservation live in `src/platform/navigation`; snapshot
reads and URL coordination remain app integration responsibilities. Normal
workflow stores and persistence own identity-aware hydration and draft aliases.
Cross-domain cancellation and baseline coverage remains in
`src/integrationTests/workflowHandoffPersistence.test.ts`, alongside focused URL,
API, store and draft suites and real-canvas browser handoff coverage.

## Shared identity boundary

The `workflow-file-identity` domain owns two exact public leaf APIs. The
`core/utils/userFileIdentity.ts` domain leaf owns the received UUID, owner and
workspace types, canonical UUID validation, comparisons, and typed scope/draft
refusals. `core/services/userFileContext.ts` owns the mutable scope provider,
current-scope observation and the compatibility wrapper that uses that scope
when receiving an identity. Domain code cannot import the mutable context.
The domain exports `UserFileScope`, `UserFileIdentity`, `SavedFileIdentityError`,
`bindReceivedUserFileIdentity`, `sameUserFileScope`, `sameUserFileIdentity` and
`SavedFilePathUnavailableError` (confirmed bound GET404/412 only).
The context exports `registerUserFileScopeProvider`, `currentUserFileScope`,
`receivedUserFileIdentity` and `isUserFileIdentityCurrent`.
Only workflow management and workflow persistence are declared consumers;
unclassified application adapters continue using the public entries under the
catalog's existing rules. Existing domains retain their access modes.

Placing this contract under the ComfyUI transport domain creates a reverse
layer dependency from document persistence. Adding persistence as a consumer
of the existing inventory-mode workflow-management domain would authorize
unrelated internals; changing that whole domain to enforced would alter
legacy policy outside this feature. A small enforced identity domain instead
makes the two supported leaves explicit without widening either legacy domain.

A matching identified draft restored from saved tabs uses the existing UUID
snapshot loader before opening a path from a potentially stale listing. An
unavailable snapshot preserves the draft and canvas without a path fallback.
Without a matching draft, a guarded path GET may still refuse after a concurrent
rename; only its contract-established 404/412 responses become a typed local
startup refusal so the URL coordinator can continue. Other transport failures
and unrelated DOM errors retain their propagation. Failed reads always clear
the document's loading state while retaining content and identity.

Workspace package classification exposes the already published
`@comfyorg/account-core/workspaceLink` subpath through the enforced
`workspace-link` domain. Only its existing pure source leaf is public; package
exports and parser bytes are unchanged. Workspace and account retain the shared
contract, navigation reuses its validator, and classified billing contract tests
retain their existing public imports. This avoids granting navigation access to
the inventory-mode workspace domain or copying its identifier regular expression.
All other workspace ownership and access modes stay unchanged.

The shared API-client extraction keeps guarded userdata operations in
`packages/api-client/src/ComfyApi.ts`, alongside the normal authentication,
retry and RequestInit transport. The app's API adapter remains the upstream
composition layer. The optional received userdata id follows its shared
`UserDataFullInfo` type into the package; existing no-id callers remain legacy
compatible and every supplied expected id still selects the mandatory namespace.
