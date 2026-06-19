import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { desktopSurveyIdentityProvider } from './desktopSurveyIdentity'

function setDesktopBridge(
  bridge:
    | {
        Surveys?: {
          getIdentity?: () => Promise<Record<string, string> | null>
        }
      }
    | undefined
) {
  ;(window as unknown as { __comfyDesktop2?: typeof bridge }).__comfyDesktop2 =
    bridge
}

describe('desktopSurveyIdentityProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    setDesktopBridge(undefined)
    vi.restoreAllMocks()
  })

  it('uses the Desktop-owned survey identity when available', async () => {
    setDesktopBridge({
      Surveys: {
        getIdentity: vi.fn().mockResolvedValue({
          anon_id: 'install-1',
          distinct_id: 'user-1',
          comfy_id: 'user-1'
        })
      }
    })

    await expect(desktopSurveyIdentityProvider.getIdentity()).resolves.toEqual({
      anon_id: 'install-1',
      distinct_id: 'user-1',
      comfy_id: 'user-1'
    })
  })

  it('falls back to a local anonymous id when the bridge returns null', async () => {
    setDesktopBridge({
      Surveys: {
        getIdentity: vi.fn().mockResolvedValue(null)
      }
    })

    const identity = await desktopSurveyIdentityProvider.getIdentity()

    expect(identity?.anon_id).toBeTruthy()
    expect(identity?.distinct_id).toBeUndefined()
    expect(identity?.comfy_id).toBeUndefined()
  })

  it('falls back to a local anonymous id when the bridge is unavailable', async () => {
    setDesktopBridge(undefined)

    const identity = await desktopSurveyIdentityProvider.getIdentity()

    expect(identity?.anon_id).toBe(localStorage.getItem('Comfy.SurveyAnonId'))
  })
})
