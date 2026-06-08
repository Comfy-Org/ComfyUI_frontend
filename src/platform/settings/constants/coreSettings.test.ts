import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { DEPRECATIONS } from '@/platform/dev/deprecations'
import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'

describe('Comfy.UseNewMenu setting', () => {
  const setting = CORE_SETTINGS.find((s) => s.id === 'Comfy.UseNewMenu')

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('reports the legacy-menu deprecation when set to Disabled', () => {
    setting?.onChange?.('Disabled')

    const warnings = useDeprecationWarningsStore().warnings
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject(DEPRECATIONS['comfyUI.legacyQueueMenu'])
  })

  it('does not report a deprecation when the new menu is active', () => {
    setting?.onChange?.('Top')

    expect(useDeprecationWarningsStore().warnings).toHaveLength(0)
  })
})
