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

export class SavedFilePathUnavailableError extends DOMException {
  constructor(
    path: string,
    public readonly status: 404 | 412,
    statusText: string
  ) {
    super(
      `Failed to load file '${path}': ${status} ${statusText}`,
      status === 404 ? 'NotFoundError' : 'InvalidStateError'
    )
  }
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

export function bindReceivedUserFileIdentity(
  id: unknown,
  scope: UserFileScope | null
): UserFileIdentity | undefined {
  return typeof id === 'string' &&
    isUuid(id) &&
    id === id.toLowerCase() &&
    scope
    ? { ...scope, id }
    : undefined
}
