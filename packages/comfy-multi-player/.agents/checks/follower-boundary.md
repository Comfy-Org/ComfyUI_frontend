# Follower and state-boundary review

Apply this profile to transport adapters, integration APIs, document writes, awareness, layout, and optimistic state. It protects KA-1, KA-6 through KA-9, FC-1, FC-5, and FC-6.

- Followers never write the shared semantic document.
- Raw Yjs updates flow host to follower one-way only. A follower sends semantic ops upstream; never merge raw updates from independently edited docs.
- Presence/awareness remains ephemeral and is never persisted in the semantic doc.
- Layout/view state remains in the separate frontend-owned Y.Doc, with an explicit reconciliation rule.
- Optimistic pending ops remain a presentation-only shadow, clear on effect rather than ack, and are never encoded or merged into the shared doc.
- Treat APIs that expose unrestricted document mutation across this boundary as blocking violations even if current callers behave correctly.

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
