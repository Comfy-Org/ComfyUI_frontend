import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { isElectron } from '@/utils/envUtil'

// Mock the API
vi.mock('@/scripts/api', () => ({
  api: {
    getSystemStats: vi.fn()
  }
}))

// Mock the envUtil
vi.mock('@/utils/envUtil', () => ({
  isElectron: vi.fn()
}))

describe('useSystemStatsStore', () => {
  let store: ReturnType<typeof useSystemStatsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSystemStatsStore()
    vi.clearAllMocks()
  })

  it('should initialize with null systemStats', () => {
    expect(store.systemStats).toBeNull()
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  describe('fetchSystemStats', () => {
    it('should fetch system stats successfully', async () => {
      const mockStats = {
        system: {
          os: 'Windows',
          python_version: '3.10.0',
          embedded_python: false,
          comfyui_version: '1.0.0',
          pytorch_version: '2.0.0',
          argv: [],
          ram_total: 16000000000,
          ram_free: 8000000000
        },
        devices: []
      }

      vi.mocked(api.getSystemStats).mockResolvedValue(mockStats)

      await store.fetchSystemStats()

      expect(store.systemStats).toEqual(mockStats)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
      expect(api.getSystemStats).toHaveBeenCalled()
    })

    it('should handle API errors', async () => {
      const error = new Error('API Error')
      vi.mocked(api.getSystemStats).mockRejectedValue(error)

      await store.fetchSystemStats()

      expect(store.systemStats).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe('API Error')
    })

    it('should handle non-Error objects', async () => {
      vi.mocked(api.getSystemStats).mockRejectedValue('String error')

      await store.fetchSystemStats()

      expect(store.error).toBe('An error occurred while fetching system stats')
    })

    it('should set loading state correctly', async () => {
      let resolvePromise: (value: any) => void = () => {}
      const promise = new Promise<any>((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(api.getSystemStats).mockReturnValue(promise)

      const fetchPromise = store.fetchSystemStats()
      expect(store.isLoading).toBe(true)

      resolvePromise({})
      await fetchPromise

      expect(store.isLoading).toBe(false)
    })
  })

  describe('getFormFactor', () => {
    beforeEach(() => {
      // Reset systemStats for each test
      store.systemStats = null
    })

    it('should return "other" when systemStats is null', () => {
      expect(store.getFormFactor()).toBe('other')
    })

    it('should return "other" when os is not available', () => {
      store.systemStats = {
        system: {
          python_version: '3.10.0',
          embedded_python: false,
          comfyui_version: '1.0.0',
          pytorch_version: '2.0.0',
          argv: [],
          ram_total: 16000000000,
          ram_free: 8000000000
        } as any,
        devices: []
      }

      expect(store.getFormFactor()).toBe('other')
    })

    describe('desktop environment (Electron)', () => {
      beforeEach(() => {
        vi.mocked(isElectron).mockReturnValue(true)
      })

      it('should return "desktop-windows" for Windows desktop', () => {
        store.systemStats = {
          system: {
            os: 'Windows 11',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('desktop-windows')
      })

      it('should return "desktop-mac" for macOS desktop', () => {
        store.systemStats = {
          system: {
            os: 'Darwin 22.0.0',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('desktop-mac')
      })

      it('should return "desktop-mac" for Mac desktop', () => {
        store.systemStats = {
          system: {
            os: 'Mac OS X 13.0',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('desktop-mac')
      })

      it('should return "other" for unknown desktop OS', () => {
        store.systemStats = {
          system: {
            os: 'Linux',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('other')
      })
    })

    describe('git environment (non-Electron)', () => {
      beforeEach(() => {
        vi.mocked(isElectron).mockReturnValue(false)
      })

      it('should return "git-windows" for Windows git', () => {
        store.systemStats = {
          system: {
            os: 'Windows 11',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('git-windows')
      })

      it('should return "git-mac" for macOS git', () => {
        store.systemStats = {
          system: {
            os: 'Darwin 22.0.0',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('git-mac')
      })

      it('should return "git-linux" for Linux git', () => {
        store.systemStats = {
          system: {
            os: 'linux Ubuntu 22.04',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('git-linux')
      })

      it('should return "other" for unknown git OS', () => {
        store.systemStats = {
          system: {
            os: 'FreeBSD',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('other')
      })
    })

    describe('case insensitive OS detection', () => {
      beforeEach(() => {
        vi.mocked(isElectron).mockReturnValue(false)
      })

      it('should handle uppercase OS names', () => {
        store.systemStats = {
          system: {
            os: 'WINDOWS',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('git-windows')
      })

      it('should handle mixed case OS names', () => {
        store.systemStats = {
          system: {
            os: 'LiNuX',
            python_version: '3.10.0',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        }

        expect(store.getFormFactor()).toBe('git-linux')
      })
    })
  })
})
