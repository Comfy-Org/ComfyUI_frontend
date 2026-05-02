import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SystemStats } from '@/schemas/apiSchema'

const mockCopyToClipboard = vi.fn()
const distributionFlags = vi.hoisted(() => ({ isCloud: false }))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: mockCopyToClipboard })
}))

vi.mock('@/platform/distribution/types', () => distributionFlags)

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

const fullCommitHash = 'a'.repeat(40)

const cloudStats: SystemStats = {
  system: {
    os: 'Linux',
    python_version: '3.11.5',
    embedded_python: false,
    comfyui_version: fullCommitHash,
    pytorch_version: '2.1.0',
    argv: [],
    ram_total: 0,
    ram_free: 0,
    cloud_version: '1.2.3',
    comfyui_frontend_version: fullCommitHash,
    workflow_templates_version: '5.0.0'
  },
  devices: []
}

async function loadComposable(isCloud: boolean) {
  distributionFlags.isCloud = isCloud
  vi.resetModules()
  const mod = await import('./useCopySystemInfo')
  return mod.useCopySystemInfo
}

describe('useCopySystemInfo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    distributionFlags.isCloud = false
  })

  describe('local distribution', () => {
    it('formats system info as markdown and copies to clipboard', async () => {
      const useCopySystemInfo = await loadComposable(false)
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
      const useCopySystemInfo = await loadComposable(false)
      const stats: SystemStats = { ...localStats, devices: [] }
      const { copySystemInfo } = useCopySystemInfo(stats)
      await copySystemInfo()

      const text = mockCopyToClipboard.mock.calls[0][0] as string
      expect(text).not.toContain('## Devices')
    })

    it('reflects updates when stats are passed as a getter', async () => {
      const useCopySystemInfo = await loadComposable(false)
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

    it('re-reads stats on each call when given a plain mutable object', async () => {
      const useCopySystemInfo = await loadComposable(false)
      const stats: SystemStats = JSON.parse(JSON.stringify(localStats))
      const { copySystemInfo } = useCopySystemInfo(stats)

      await copySystemInfo()
      expect(mockCopyToClipboard.mock.calls[0][0]).toContain('OS: Linux')

      stats.system.os = 'Windows'
      await copySystemInfo()
      expect(mockCopyToClipboard.mock.calls[1][0]).toContain('OS: Windows')
    })
  })

  describe('cloud distribution', () => {
    it('formats cloud-specific columns and formats commit hashes', async () => {
      const useCopySystemInfo = await loadComposable(true)
      const { copySystemInfo } = useCopySystemInfo(cloudStats)
      await copySystemInfo()

      const text = mockCopyToClipboard.mock.calls[0][0] as string
      const truncated = fullCommitHash.slice(0, 7)
      expect(text).toContain('## System Info')
      expect(text).toContain('Cloud Version: 1.2.3')
      expect(text).toContain(`ComfyUI Version: ${truncated}`)
      expect(text).toContain('Templates Version: 5.0.0')
      expect(text).not.toContain('OS: Linux')
      expect(text).not.toContain('Python Version')
    })
  })
})
