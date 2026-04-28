import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCopyToClipboard = vi.fn()

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: mockCopyToClipboard })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

import type { SystemStats } from '@/schemas/apiSchema'

import { useCopySystemInfo } from './useCopySystemInfo'

const localStats: SystemStats = {
  system: {
    os: 'Linux',
    python_version: '3.11.5',
    embedded_python: false,
    comfyui_version: 'v0.3.0',
    pytorch_version: '2.1.0',
    argv: ['main.py', '--cpu'],
    ram_total: 16_000_000_000,
    ram_free: 8_000_000_000,
    installed_templates_version: '1.0.0'
  },
  devices: [
    {
      name: 'cpu',
      type: 'cpu',
      index: 0,
      vram_total: 0,
      vram_free: 0,
      torch_vram_total: 0,
      torch_vram_free: 0
    }
  ]
}

describe('useCopySystemInfo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('formats system info as markdown and copies to clipboard', async () => {
    const { copySystemInfo } = useCopySystemInfo(localStats)
    await copySystemInfo()

    expect(mockCopyToClipboard).toHaveBeenCalledTimes(1)
    const text = mockCopyToClipboard.mock.calls[0][0] as string
    expect(text).toContain('## System Info')
    expect(text).toContain('OS: Linux')
    expect(text).toContain('Python Version: 3.11.5')
    expect(text).toContain('Arguments: main.py --cpu')
    expect(text).toContain('## Devices')
    expect(text).toContain('- cpu (cpu)')
  })

  it('omits the Devices section when no devices are present', async () => {
    const stats: SystemStats = { ...localStats, devices: [] }
    const { copySystemInfo } = useCopySystemInfo(stats)
    await copySystemInfo()

    const text = mockCopyToClipboard.mock.calls[0][0] as string
    expect(text).not.toContain('## Devices')
  })

  it('reflects updates when stats are passed as a getter', async () => {
    const statsRef = ref<SystemStats>(localStats)
    const { copySystemInfo } = useCopySystemInfo(() => statsRef.value)

    await copySystemInfo()
    expect(mockCopyToClipboard.mock.calls[0][0]).toContain('OS: Linux')

    statsRef.value = {
      ...localStats,
      system: { ...localStats.system, os: 'Windows' }
    }
    await copySystemInfo()
    expect(mockCopyToClipboard.mock.calls[1][0]).toContain('OS: Windows')
  })
})
