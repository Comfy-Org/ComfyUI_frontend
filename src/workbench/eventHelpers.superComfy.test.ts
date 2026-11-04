import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSuperComfyNavigationStore } from '@/platform/superComfy/stores/superComfyNavigationStore'
import { shouldIgnoreCopyPaste } from '@/workbench/eventHelpers'

vi.mock(import('@/composables/useFeatureFlags'))

describe('shouldIgnoreCopyPaste with SuperComfy', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).superComfyEnabled = true
  })

  it('lets the graph canvas handle copy and paste while SuperComfy is closed', () => {
    expect(shouldIgnoreCopyPaste(document.body)).toBe(false)
  })

  it('keeps copy and paste away from the hidden graph while SuperComfy is open', () => {
    useSuperComfyNavigationStore().open()

    expect(shouldIgnoreCopyPaste(document.body)).toBe(true)
  })
})
