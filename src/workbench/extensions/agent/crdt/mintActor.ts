/**
 * Backend actor for `ensureDoc`'s lazy, first-ever doc creation (cloud
 * `crdt.go`) — a `doc_reset`/`follower_replaced` frame carrying it has no
 * prior CRDT-tracked content to lose.
 *
 * Kept in its own module, separate from `docFrameClient.ts`, so a consumer
 * that only needs this constant (the reset-sweep skip check in
 * `useAgentCrdtFollower.ts`) can import the real value even from a test that
 * module-mocks `docFrameClient.ts` wholesale. `docFrameClient.ts` imports it
 * too, for its own actor-grammar check.
 */
export const SYSTEM_MINT_ACTOR = 'system:mint'
