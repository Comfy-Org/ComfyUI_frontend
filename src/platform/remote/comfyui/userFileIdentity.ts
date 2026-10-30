import { validate as isUuid } from 'uuid'

export interface UserFileScope {
  ownerId: string
  workspaceId: string
}

export interface UserFileIdentity extends UserFileScope {
  id: string
}

export class SavedFileIdentityError extends DOMException {
  constructor(public readonly reason: 'scope' | 'draft') {
    super(
      reason === 'scope'
        ? 'Saved file belongs to another authenticated scope'
        : 'Saved workflow draft identity does not match this document',
      reason === 'scope' ? 'SecurityError' : 'InvalidStateError'
    )
  }
}

let scopeProvider: () => UserFileScope | null = () => null

export function registerUserFileScopeProvider(
  provider: () => UserFileScope | null
) {
  scopeProvider = provider
}

export function currentUserFileScope(): UserFileScope | null {
  return scopeProvider()
}

export function sameUserFileScope(
  left: UserFileScope | null | undefined,
  right: UserFileScope | null | undefined
): boolean {
  return (
    !!left &&
    !!right &&
    left.ownerId === right.ownerId &&
    left.workspaceId === right.workspaceId
  )
}

export function sameUserFileIdentity(
  left: UserFileIdentity | undefined,
  right: UserFileIdentity | undefined
): boolean {
  return (
    !!left && !!right && left.id === right.id && sameUserFileScope(left, right)
  )
}

export function receivedUserFileIdentity(
  id: unknown,
  scope = currentUserFileScope()
): UserFileIdentity | undefined {
  return typeof id === 'string' &&
    isUuid(id) &&
    id === id.toLowerCase() &&
    scope
    ? { ...scope, id }
    : undefined
}

export function isUserFileIdentityCurrent(
  identity: UserFileIdentity | undefined
): boolean {
  return !identity || sameUserFileScope(identity, currentUserFileScope())
}
