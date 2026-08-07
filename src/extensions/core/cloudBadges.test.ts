import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { TopbarBadge } from '@/types/comfy'

const mocks = vi.hoisted(() => ({
  canvasStore: { canvas: null as LGraphCanvas | null },
  registerExtension: vi.fn(),
  remoteConfig: { value: {} as RemoteConfig }
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: mocks.remoteConfig
}))

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
    mocks.remoteConfig.value = {}
  })

  it('brands the canvas with the accessible Comfy Cloud yellow', async () => {
    const canvas = {} as LGraphCanvas
    mocks.canvasStore.canvas = canvas

    await import('./cloudBadges')

    expect(canvas.info_text).toBe('g.comfyCloud')
    expect(canvas.info_text_color).toBe('#F0FF41')
  })

  it('exposes server health alerts through the registered extension', async () => {
    mocks.remoteConfig.value = {
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
