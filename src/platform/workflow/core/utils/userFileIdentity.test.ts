import { describe, expect, it } from 'vitest'

import {
  SavedFileIdentityError,
  SavedFilePathUnavailableError,
  bindReceivedUserFileIdentity,
  sameUserFileIdentity,
  sameUserFileScope
} from './userFileIdentity'

const scope = { ownerId: 'owner-a', workspaceId: 'workspace-a' }
const id = 'a9f81265-e73b-40b3-8106-042ec09838d5'

it('receives a canonical saved-file identity in the supplied scope', () => {
  const suppliedScope = { ...scope }
  const identity = bindReceivedUserFileIdentity(id, suppliedScope)
  expect(identity).toEqual({ ...scope, id })
  suppliedScope.ownerId = 'owner-b'
  expect(identity?.ownerId).toBe('owner-a')
})

it.for([undefined, '', 'not-a-uuid', id.toUpperCase()])(
  'rejects a noncanonical received identity: %s',
  (value) => {
    expect(bindReceivedUserFileIdentity(value, scope)).toBeUndefined()
  }
)

it('keeps unknown scope unbound', () => {
  expect(bindReceivedUserFileIdentity(id, null)).toBeUndefined()
  expect(sameUserFileScope(null, null)).toBe(false)
  expect(sameUserFileIdentity(undefined, undefined)).toBe(false)
})

it.for([
  { ownerId: 'owner-b', workspaceId: scope.workspaceId, id },
  { ...scope, workspaceId: 'workspace-b', id },
  { ...scope, id: '7bca837c-6870-45d6-81b8-681058d4ba0d' }
])('distinguishes files across owner, workspace and UUID: %j', (other) => {
  expect(sameUserFileIdentity({ ...scope, id }, other)).toBe(false)
})

it('accepts the exact same received identity', () => {
  expect(sameUserFileIdentity({ ...scope, id }, { ...scope, id })).toBe(true)
})

describe('identity refusal classification', () => {
  it.for([
    {
      reason: 'scope',
      name: 'SecurityError',
      message: 'Saved file belongs to another authenticated scope'
    },
    {
      reason: 'draft',
      name: 'InvalidStateError',
      message: 'Saved workflow draft identity does not match this document'
    }
  ] as const)(
    'retains the $reason DOMException contract',
    ({ reason, name, message }) => {
      const error = new SavedFileIdentityError(reason)
      expect(error).toBeInstanceOf(DOMException)
      expect(error).toMatchObject({ reason, name, message })
    }
  )
})

it.for([
  { status: 404, name: 'NotFoundError' },
  { status: 412, name: 'InvalidStateError' }
] as const)(
  'retains the guarded path refusal HTTP$status contract',
  ({ status, name }) => {
    const error = new SavedFilePathUnavailableError(
      'workflows/old.json',
      status,
      'status text'
    )
    expect(error).toBeInstanceOf(DOMException)
    expect(error).toMatchObject({
      status,
      name,
      message: `Failed to load file 'workflows/old.json': ${status} status text`
    })
  }
)
