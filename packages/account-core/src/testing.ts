/**
 * The test seam for fakes: a hand-written port becomes an identity the
 * session client accepts. Production hosts use `@comfyorg/account-core/firebase`.
 */
export type { IdentityPort } from './core/identity.js'
export { brandIdentity as createTestIdentity } from './core/identity.js'

// Enumerating wording (CWE-204) each host asserts its copy never matches; shared so the two suites can't drift.
export const ENUMERATION_ORACLE =
  /\bexists?\b|already (?:registered|in use|have|exists)|wrong password|no account|not found|is registered|different (?:sign-in method|credential)/i
