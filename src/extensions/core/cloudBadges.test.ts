import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { TopbarBadge } from '@/types/comfy'

const mocks = vi.hoisted(() => ({
  canvasStore: { canvas: null as LGraphCanvas | null },
  registerExtension: vi.fn()
}))

vi.mock('@/i18n', async () => {
  const { ref } = await import('vue')
  const locale = ref('en')
  return {
    i18n: { global: { locale } },
    t: (key: string) => `${key}:${locale.value}`
  }
})

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/remoteConfig/remoteConfig', async () => {
  const { ref } = await import('vue')
  return { remoteConfig: ref({}) }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mocks.canvasStore
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: mocks.registerExtension
  })
}))

describe('cloudBadges', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.canvasStore.canvas = null
    mocks.registerExtension.mockReset()
    remoteConfig.value = {}
    i18n.global.locale.value = 'en'
  })

  it('brands the canvas with the accessible Comfy Cloud yellow', async () => {
    const canvas = {} as LGraphCanvas
    mocks.canvasStore.canvas = canvas
    remoteConfig.value = {
      comfy_api_base_url: 'https://api.example.com'
    }

    await import('./cloudBadges')

    expect(canvas.info_text).toBe('g.comfyCloud:en')
    expect(canvas.info_text_color).toBe('#F0FF41')

    i18n.global.locale.value = 'fr'
    await nextTick()
    expect(canvas.info_text).toBe('g.comfyCloud:fr')

    remoteConfig.value = {}
    await nextTick()
    expect(canvas.info_text).toBeUndefined()
    expect(canvas.info_text_color).toBeUndefined()
  })

  it('exposes server health alerts through the registered extension', async () => {
    remoteConfig.value = {
      server_health_alert: {
        message: 'Maintenance in progress',
        badge: 'STATUS',
        severity: 'warning',
        tooltip: 'Check status for details'
      }
    }

    await import('./cloudBadges')

    expect(mocks.registerExtension).toHaveBeenCalledTimes(1)
    const extension = mocks.registerExtension.mock.calls[0]?.[0] as {
      topbarBadges: TopbarBadge[]
    }
    expect(extension.topbarBadges).toEqual([
      {
        text: 'Maintenance in progress',
        label: 'STATUS',
        variant: 'warning',
        tooltip: 'Check status for details'
      }
    ])
  })
})
