# ADR-AUTH-IDENTITY-0033: The Account Package Owns Identity and the Session Client Takes It at Construction

Date: 2026-09-16

## Status

Accepted

Supersedes the original transitional text of
[AUTH-IDENTITY-0028](AUTH-IDENTITY-0028-account-package-firebase-entry-delivers-cloud-identity.md)
(the Pinia identity adapter and the `attachIdentity` seam); rules 1–5 of
0028 as amended on 2026-09-16 stand.

## Context

ADR-AUTH-IDENTITY-0028 first shipped a transitional shape: the cloud app
owned identity (vuefire plus the Pinia `authStore`) and pushed it into the
`@comfyorg/account-core` session client through `attachIdentity`, a
post-construction seam guarded at runtime by `isAccountIdentity`. The Workshop
site attached the same way. The account TDD needs the package to own Firebase
initialization and sign-in state so one account layer serves the cloud app,
the website, and platform.comfy.org, framework-agnostic and publishable, and
so SSO can land without a second source of identity truth. The seam was
marked `@deprecated` with this ADR as its tracked removal (FE-2196).

Before the migration, `createSessionClient` was a 744-line closure that
mutated session state from eleven sites; building the shared foundation on
that shape was rejected in review (FE-2191).

## Decision

Identity ownership moves into the package, and the session client takes its
identity only at construction. Landed as one bottom-up stack, each slice
inert behind `unified_cloud_auth`:

1. **Decomposition (FE-2191).** Every session commit runs through one pure
   `transition(state, event)` in `sessionState.ts` that returns the next
   state and an ordered effect list; mint arbitration is a pure function;
   the credential cache and the in-flight mint coordinator are their own
   modules. Behavior unchanged, proven by the untouched suites.
2. **Constructor injection.** `createSessionClient(options, identity)`
   subscribes the identity at construction; `dispose()` detaches it once and
   is idempotent. `autoMint` is a client option.
3. **The cloud store constructs with identity.** `workspaceAuthStore` passes
   the package's Firebase entry to `createSessionClient`; the flag-watch
   attach/detach and its re-sync helpers are gone. `authStore` is a
   projection for app-wide side effects and pushes nothing into the client.
4. **Lazy identity for the lazy-Firebase host.** The Workshop site loads
   Firebase on first need, so the package ships `createLazyIdentity`: a
   branded port that activates on its first delivery and drops loader
   rejections that land after deactivation. Construct-with-identity holds
   without eager Firebase.
5. **Package-initialized Firebase.** The cloud app's identity module creates
   the `[DEFAULT]` app from remote config through the package entry, with an
   ordered persistence hierarchy (`browserLocalPersistence`, then
   `indexedDBLocalPersistence`, the store vuefire persisted into, then
   `browserSessionPersistence`) so an existing session is restored from any
   of them and settles in localStorage, and with
   `browserPopupRedirectResolver`, which `initializeAuth` does not wire on its
   own and popup sign-in needs; vuefire no longer initializes Firebase, and
   `main.ts` calls `initialize()` explicitly after remote config loads.
6. **Seam deletion (this slice).** `attachIdentity`, `AttachIdentityOptions`,
   and the `isAccountIdentity` runtime gate are removed. The `AccountIdentity`
   brand is a compile-time gate only: the package's Firebase entry and
   `createLazyIdentity` mint it, and the `testing` seam deliberately exposes
   the minter as `createTestIdentity` for fakes. A hand-rolled port is a
   compile error; no runtime check remains, so a JavaScript consumer is not
   stopped.
   Re-attaching or replacing an identity is no longer a behavior the client
   has.

Hosts supply only adapters: storage, transport, clock, navigation, and the
active workspace. Mints stay host-driven in the cloud app (`autoMint: false`).

### Invariants preserved (ADR-AUTH-CREDENTIALS-0011)

Live credential over storage; the popup mint before the first identity
delivery; refresh re-arm, cross-tab lease, and cookie rotation; the
`mintSequence` and target-mismatch fail-closed on a workspace switch;
sign-out through `invalidate()` keeps the identity; no personal-token
downgrade. Every mint, refresh, and arbitration assertion in the package
suites is unchanged across the stack.

### Alternatives rejected

- **Keep the adapter permanently.** Blocks the framework-agnostic publish and
  SSO, and calcifies a second identity authority.
- **Big-bang rewrite.** Unshippable without the flag as a safety net.
- **Package owns Firebase, host keeps identity authority.** Leaves the
  dual source of truth the TDD exists to remove.
- **Keep `isAccountIdentity` as defense in depth.** It guarded unbranded ports
  pushed in through `attachIdentity`, which no longer exists; the brand type is
  the contract, and `./testing` is the one deliberate way to mint it.

## Consequences

### Positive

- The cloud app and the Workshop site bind identity the same way, through
  the same package entry, so session behavior cannot drift between them.
- The Pinia stores are thin reactive views over `session.subscribe`.
- The package public surface is construction plus `dispose`, which is what
  the core/ui split and the npm publish need; a non-Firebase identity later
  is a second branded entry, not a host adapter.

### Negative

- The package API is a breaking change for external consumers. Only Comfy
  web surfaces consume it today.
- The Firebase-init switch was the highest-risk slice; its real-SDK
  acceptance (popup sign-in, refresh re-arm, workspace switch, sign-out) is
  proven only by the e2e gate in CI.
- The legacy workspace-token rail and the `unified_cloud_auth` flag remain
  until FE-951 retires them.

## Notes

Blast radius: the two auth stores, the sign-in composables and components,
the Workshop session host, and the package public API. No entity callback,
`node.*`, or `graph._version` surface is touched, so the ADR-CRDT-LAYOUT-0003
and ADR-ECS-0008 extension-migration clause does not apply.
