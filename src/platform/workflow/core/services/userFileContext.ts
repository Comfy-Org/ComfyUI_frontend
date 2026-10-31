import type {
  UserFileIdentity,
  UserFileScope
} from '@/platform/workflow/core/utils/userFileIdentity'
import {
  bindReceivedUserFileIdentity,
  sameUserFileScope
} from '@/platform/workflow/core/utils/userFileIdentity'

let scopeProvider: () => UserFileScope | null = () => null

export function registerUserFileScopeProvider(
  provider: () => UserFileScope | null
) {
  scopeProvider = provider
}

export function currentUserFileScope(): UserFileScope | null {
  return scopeProvider()
}

export function receivedUserFileIdentity(
  id: unknown,
  scope = currentUserFileScope()
): UserFileIdentity | undefined {
  return bindReceivedUserFileIdentity(id, scope)
}

export function isUserFileIdentityCurrent(
  identity: UserFileIdentity | undefined
): boolean {
  return !identity || sameUserFileScope(identity, currentUserFileScope())
}
