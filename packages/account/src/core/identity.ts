import type { AccountUser } from './session.js'

/**
 * The identity boundary. An internal port, not a host adapter: real hosts
 * get their implementation from `@comfyorg/account/firebase`; tests brand a
 * fake through `@comfyorg/account/testing`. `attachIdentity` accepts only
 * the branded form.
 */
export interface IdentityPort<TUser extends AccountUser = AccountUser> {
  onUserChanged: (callback: (user: TUser | null) => void) => () => void
}

/**
 * Only the package's own identity entry (and the `./testing` seam) can mint
 * an identity the session client accepts. A host cannot hand in its own
 * provider: the symbol lives in a module the exports map never exposes.
 * Registered globally so a re-instantiated module (test isolation, two
 * copies of the package) still recognises its own brand.
 */
export const identityBrand: unique symbol = Symbol.for(
  '@comfyorg/account identity'
)

export interface AccountIdentity<
  TUser extends AccountUser = AccountUser
> extends IdentityPort<TUser> {
  readonly [identityBrand]: true
}

export function brandIdentity<TUser extends AccountUser>(
  port: IdentityPort<TUser>
): AccountIdentity<TUser> {
  return { ...port, [identityBrand]: true }
}

export function isAccountIdentity(value: unknown): value is AccountIdentity {
  return typeof value === 'object' && value !== null && identityBrand in value
}
