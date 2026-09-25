import type { AccountUser } from './sessionContracts.js'

/**
 * The identity boundary. An internal port, not a host adapter: real hosts
 * get their implementation from `@comfyorg/account-core/firebase`; tests brand a
 * fake through `@comfyorg/account-core/testing`. `createSessionClient` accepts
 * only the branded form.
 */
export interface IdentityPort<TUser extends AccountUser = AccountUser> {
  onUserChanged: (callback: (user: TUser | null) => void) => () => void
}

/**
 * The brand is a compile-time gate only: `createSessionClient` rejects an
 * unbranded port in the type system, and no runtime check remains. The
 * package's own identity entries mint it, and `./testing` deliberately
 * re-exports the minter as `createTestIdentity` so a suite can brand a fake.
 */
export const identityBrand: unique symbol = Symbol(
  '@comfyorg/account-core identity'
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
