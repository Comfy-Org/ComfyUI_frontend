# Disabled homepage runtime source delivery

This source branch starts at the website's pinned frontend revision
`099194d5b815bed3c14f1385c13899e4829a46ff`. Only account-core and ingest-types
gain the consent-delivery entries. No dependency versions, consent values,
experiments, UI, banners or vendor integrations change.

Consumers import the framework-free implementation from
`@comfyorg/account-core/analyticsConsentRuntime` and its receipt bridge from
`@comfyorg/account-core/analyticsConsentReceiptBridge`. The generated response
schema is `@comfyorg/ingest-types/homepage-consent`, copied exactly from the
reviewed backend contract. The runtime's production configuration is frozen off.
No approved notice, policy or consent source is supplied by this change.

The website must use its existing shared-package sync rather than hand-editing
vendored packages. A local rehearsal can exercise that same sync implementation
against this local commit and prove bundle/tests/exports without a registry
publication. Such a rehearsal does not satisfy the upstream-main ancestry gate.
After source review and a separately authorized upstream merge, rerun
`pnpm shared-packages:sync <actual merged full SHA>` in the website branch and
verify normal upstream checks. Never claim the unmerged rehearsal pin is ready
for production or weaken the main-ancestry check.

The website host may retain an injected binder for tests; its default binder can
then import this shared entry directly. Supplying a real consent-event source and
reviewed matching policy/notice remains an independent hold. SDK opt-out and
Agent/OAuth/default analytics booleans are not substituted.
