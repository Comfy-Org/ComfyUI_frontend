import { describe, expect, it } from 'vitest'

import { roleLabelKey } from '@/platform/workspace/utils/roleLabels'

describe('roleLabelKey', () => {
  it('labels the workspace creator as Owner', () => {
    expect(roleLabelKey('owner', true)).toBe('workspaceSwitcher.roleOwner')
  })

  it('labels a non-creator owner-role member as Admin', () => {
    expect(roleLabelKey('owner', false)).toBe('workspaceSwitcher.roleAdmin')
  })

  it('labels a member as Member regardless of creator flag', () => {
    expect(roleLabelKey('member', false)).toBe('workspaceSwitcher.roleMember')
    expect(roleLabelKey('member', true)).toBe('workspaceSwitcher.roleMember')
  })
})
