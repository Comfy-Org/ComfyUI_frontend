import { describe, expect, it } from 'vitest'

import { workspaceLinkedHref } from './workshop-workspace-link'

describe('workspaceLinkedHref', () => {
  it('returns the plain link when no workspace is known', () => {
    expect(
      workspaceLinkedHref(
        'https://platform.comfy.org/profile/api-keys',
        undefined
      )
    ).toBe('https://platform.comfy.org/profile/api-keys')
  })

  it('appends the workspace to a link with no existing query', () => {
    expect(
      workspaceLinkedHref(
        'https://platform.comfy.org/profile/api-keys',
        'ws-team'
      )
    ).toBe('https://platform.comfy.org/profile/api-keys?workspace=ws-team')
  })

  it('preserves existing query parameters', () => {
    expect(
      workspaceLinkedHref('https://cloud.comfy.org/?utm_source=nav', 'ws-team')
    ).toBe('https://cloud.comfy.org/?utm_source=nav&workspace=ws-team')
  })

  it('replaces rather than duplicates an existing workspace parameter', () => {
    expect(
      workspaceLinkedHref(
        'https://platform.comfy.org/profile/api-keys?workspace=stale',
        'ws-team'
      )
    ).toBe('https://platform.comfy.org/profile/api-keys?workspace=ws-team')
  })

  it('falls back to the plain link on an id outside the shared charset', () => {
    expect(
      workspaceLinkedHref(
        'https://platform.comfy.org/profile/api-keys',
        'not a valid id/'
      )
    ).toBe('https://platform.comfy.org/profile/api-keys')
  })
})
