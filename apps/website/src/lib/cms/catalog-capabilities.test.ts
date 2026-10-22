import { describe, expect, it } from 'vitest'

import type { LocalCatalogRole } from './catalog-capabilities'
import { hasCatalogCapability, narrowToLocalRole } from './catalog-capabilities'

const grants = [
  { can_edit: false, can_apply: false },
  { can_edit: true, can_apply: false },
  { can_edit: false, can_apply: true },
  { can_edit: true, can_apply: true }
] as const

describe('hasCatalogCapability', () => {
  it.for(grants)(
    'opens the administration for edit=$can_edit apply=$can_apply only when either is granted',
    (capabilities) => {
      expect(hasCatalogCapability(capabilities)).toBe(
        capabilities.can_edit || capabilities.can_apply
      )
    }
  )
})

describe('narrowToLocalRole', () => {
  const roles: LocalCatalogRole[] = ['review', 'edit', 'publish']
  const cases = grants.flatMap((capabilities) =>
    roles.map((role) => ({ ...capabilities, role }))
  )

  it.for(cases)(
    'keeps only what the server granted for edit=$can_edit apply=$can_apply as $role',
    ({ role, ...capabilities }) => {
      const narrowed = narrowToLocalRole(
        { ...capabilities, actor_uid: 'kept' },
        role
      )
      expect(narrowed).toEqual({
        actor_uid: 'kept',
        can_edit: capabilities.can_edit && role !== 'review',
        can_apply: capabilities.can_apply && role === 'publish'
      })
      // A role never grants: nothing the server withheld comes back.
      if (!capabilities.can_edit) expect(narrowed.can_edit).toBe(false)
      if (!capabilities.can_apply) expect(narrowed.can_apply).toBe(false)
    }
  )

  it('matches the tester and demo roles the sessions issue', () => {
    const full = { can_edit: true, can_apply: true }
    expect(narrowToLocalRole(full, 'review')).toEqual({
      can_edit: false,
      can_apply: false
    })
    expect(narrowToLocalRole(full, 'edit')).toEqual({
      can_edit: true,
      can_apply: false
    })
    expect(narrowToLocalRole(full, 'publish')).toEqual(full)
  })
})
