import type { AccountUser, IdentityPort } from './session.js'

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
