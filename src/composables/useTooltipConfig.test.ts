import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildTooltipConfig } from './useTooltipConfig'

const { getSetting } = vi.hoisted(() => ({ getSetting: vi.fn() }))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: getSetting })
}))

describe('buildTooltipConfig', () => {
  beforeEach(() => {
    getSetting.mockReset()
  })

  it('keeps a fixed delay and avoids the store by default', () => {
    const config = buildTooltipConfig('Cancel job')

    expect(config.value).toBe('Cancel job')
    expect(config.showDelay).toBe(300)
    expect(getSetting).not.toHaveBeenCalled()
  })

  it('uses the configured tooltip delay when global delay is enabled', () => {
    getSetting.mockReturnValue(150)

    const config = buildTooltipConfig('Cancel job', true)

    expect(getSetting).toHaveBeenCalledWith('LiteGraph.Node.TooltipDelay')
    expect(config.showDelay).toBe(150)
  })
})
