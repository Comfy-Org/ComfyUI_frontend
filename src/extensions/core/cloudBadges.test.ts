import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { ComfyApp } from '@/scripts/app'

import { cloudBadgesExtension as extension } from './cloudBadges'

vi.mock(import('@/i18n'))

vi.mock(import('vue'), { spy: true })

const watchersStartedAtImport = vi.mocked(watch).mock.calls.length

describe('cloudBadges', () => {
  it('reads no canvas store and starts no watcher at import', () => {
    expect(extension.name).toBe('Comfy.Cloud.Badges')
    expect(watchersStartedAtImport).toBe(0)
  })

  it('labels the current and every later canvas with the boot deployment from one watcher started in init', async () => {
    const canvasStore = useCanvasStore()
    const deploymentPickStore = useDeploymentPickStore()
    const initialCanvas = fromPartial<LGraphCanvas>({})
    canvasStore.canvas = initialCanvas
    vi.mocked(watch).mockClear()

    await extension.init?.(fromPartial<ComfyApp>({}))

    expect(watch).toHaveBeenCalledTimes(1)
    expect(initialCanvas.info_text).toBeUndefined()

    deploymentPickStore.bootDeployment = null
    await nextTick()
    expect(initialCanvas.info_text).toBe('deploymentSwitcher.comfyCloud')

    const nextCanvas = fromPartial<LGraphCanvas>({})
    canvasStore.canvas = nextCanvas
    await nextTick()
    expect(nextCanvas.info_text).toBe('deploymentSwitcher.comfyCloud')
  })
})
