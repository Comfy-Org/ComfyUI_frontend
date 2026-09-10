import type { AccountUser, IdentityPort } from './session.js'

/**
 * Only the package's own identity entry (and the `./testing` seam) can mint
 * an identity the session client accepts. A host cannot hand in its own
 * provider: the symbol lives in a module the exports map never exposes.
 */
export const identityBrand: unique symbol = Symbol('@comfyorg/account identity')

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
