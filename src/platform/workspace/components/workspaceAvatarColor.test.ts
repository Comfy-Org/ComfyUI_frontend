import { describe, expect, it } from 'vitest'

import {
  WORKSPACE_AVATAR_PALETTE,
  workspaceAvatarColor
} from './workspaceAvatarColor'

describe('workspaceAvatarColor', () => {
  it('always returns a palette color', () => {
    for (const name of ['', 'a', 'Team Comfy', '작업공간', '🎨 studio']) {
      expect(WORKSPACE_AVATAR_PALETTE).toContain(workspaceAvatarColor(name))
    }
  })

  it('is deterministic for the same name', () => {
    expect(workspaceAvatarColor('Team Comfy')).toBe(
      workspaceAvatarColor('Team Comfy')
    )
  })

  it('distinguishes workspaces that share a first letter', () => {
    expect(workspaceAvatarColor('Team Comfy')).not.toBe(
      workspaceAvatarColor('Test Renders')
    )
  })

  it('handles a missing name', () => {
    expect(WORKSPACE_AVATAR_PALETTE).toContain(workspaceAvatarColor(null))
    expect(WORKSPACE_AVATAR_PALETTE).toContain(workspaceAvatarColor(undefined))
  })
})
