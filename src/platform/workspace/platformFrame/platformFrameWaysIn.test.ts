import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { usePlatformFrameStore } from './platformFrameStore'
import {
  NEW_DEPLOYMENT_FOR_WORKFLOW,
  openPlatformFrameOnClick
} from './platformFrameWaysIn'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('firebase/auth'))

function framedAt(): Record<string, string> | null {
  const url = usePlatformFrameStore().session?.url
  if (!url) return null
  return Object.fromEntries(
    [...new URL(url).searchParams].filter(([key]) =>
      ['step', 'start'].includes(key)
    )
  )
}

function flagOn(on: boolean) {
  Object.assign(useFeatureFlags().flags, {
    customDeploymentsEditorEnabled: on
  })
}

beforeEach(() => {
  flagOn(true)
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
})

afterEach(() => {
  usePlatformFrameStore().close()
})

describe('openPlatformFrameOnClick', () => {
  it('opens the frame in place of the link', () => {
    const click = new MouseEvent('click', { cancelable: true })

    expect(
      openPlatformFrameOnClick(click, NEW_DEPLOYMENT_FOR_WORKFLOW, 'set_up')
    ).toBe(true)

    expect(click.defaultPrevented).toBe(true)
    expect(framedAt()).toEqual({ step: 'new' })
  })

  it.for([
    { label: 'a click that asks for its own tab', key: { metaKey: true } },
    { label: 'the flag off', key: {} }
  ])('leaves the link alone on $label', ({ key }) => {
    if (!('metaKey' in key)) flagOn(false)
    const click = new MouseEvent('click', { cancelable: true, ...key })

    expect(
      openPlatformFrameOnClick(click, NEW_DEPLOYMENT_FOR_WORKFLOW, 'set_up')
    ).toBe(false)

    expect(click.defaultPrevented).toBe(false)
    expect(framedAt()).toBeNull()
  })
})
