import { describe, expect, it } from 'vitest'

import { roleLabelKey } from '@/platform/workspace/utils/roleLabels'

describe('roleLabelKey', () => {
  it('labels owners as Owner', () => {
    expect(roleLabelKey('owner')).toBe('workspaceSwitcher.roleOwner')
  })

  it('labels members as Member', () => {
    expect(roleLabelKey('member')).toBe('workspaceSwitcher.roleMember')
  })
})
