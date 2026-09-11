/**
 * The test seam for fakes: a hand-written port becomes an identity the
 * session client accepts. Production hosts use `@comfyorg/account/firebase`.
 */
export type { IdentityPort } from './core/identity.js'
export { brandIdentity as createTestIdentity } from './core/identity.js'
