import { afterEach, expect, it } from 'vitest'

import {
  currentUserFileScope,
  isUserFileIdentityCurrent,
  receivedUserFileIdentity,
  registerUserFileScopeProvider
} from './userFileContext'

const scope = { ownerId: 'owner-a', workspaceId: 'workspace-a' }
const id = 'a9f81265-e73b-40b3-8106-042ec09838d5'
afterEach(() => registerUserFileScopeProvider(() => null))

it('observes the currently registered scope without changing explicit received scope', () => {
  let active = scope
  registerUserFileScopeProvider(() => active)
  const identity = receivedUserFileIdentity(id)
  expect(currentUserFileScope()).toEqual(scope)
  expect(isUserFileIdentityCurrent(identity)).toBe(true)
  active = { ...scope, workspaceId: 'workspace-b' }
  expect(isUserFileIdentityCurrent(identity)).toBe(false)
  expect(receivedUserFileIdentity(id, scope)).toEqual(identity)
})

it('keeps legacy no-ID files usable while authentication scope is unknown', () => {
  registerUserFileScopeProvider(() => null)
  expect(currentUserFileScope()).toBeNull()
  expect(receivedUserFileIdentity(id)).toBeUndefined()
  expect(isUserFileIdentityCurrent(undefined)).toBe(true)
  expect(isUserFileIdentityCurrent({ ...scope, id })).toBe(false)
})
