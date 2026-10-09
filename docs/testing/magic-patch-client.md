# Magic Patch client checkpoint

The standalone Magic Patch service owns conversion requests and jobs. This
frontend checkpoint adds a generated shared contract, transport-injected client
and pure polling projection. No component, route, consent dialog or service
capability is enabled by importing these modules. The existing Library action
stays disabled until authenticated gateway/service readiness is established.

Compose the client with `api.fetchApi.bind(api)`, a qualified readiness predicate
and the existing `useNodeAccountScope()` capture/current guard. Never construct
credentials, tenant headers or a new cookie fallback here. Capture the same
scope generation and unique scan ID for each polling traversal. Start every
poll cycle without a cursor and apply pages to `reduceMagicPatchPoll` only under
that scope/scan. Successful full traversals replace the unacknowledged listing;
failed or stale traversals preserve known state. This is not a durable change
feed, pending-job aggregate or snapshot API.

Client operations return `{ ok: true, value }` or an explicit failure code.
Diagnostics contain bounded codes, not rejected payloads or private logs. A
failed submission response can hide an admitted intent: retain the exact source
and idempotency key and reconcile it before retry. Withdrawal/cancellation
acknowledgement does not establish worker termination or pin/runtime readiness.

Generated types/Zod schemas come from the standalone service's draft OpenAPI;
never redeclare response DTOs. Reports retain an unknown content shape until the
report validator is implemented, but exact returned bytes must match both the
expected report SHA256 and response header. A matching report hash alone does
not validate conversion semantics, qualification or Registry admission.

Validation uses stubbed owned transport and Node WebCrypto, without real network,
model, pack, rendering or browser execution. The selected Community baseline is
FREDDY's sealed53 tree on exact92e. Two inherited `it.each` scalar test cases were
changed to `it.for` in this isolated successor to meet repository-wide lint;
assertions and cases remain intact. FREDDY's source/export was not changed.

Visual implementation follows the live Figma standards prerequisite in
`docs/guidance/design-standards.md`. Live Figma was inaccessible in this session;
only nonvisual logic is included. Browser acceptance, graph refresh, consent,
progress mounting, first-render eligibility and repair UI remain separate gates.
