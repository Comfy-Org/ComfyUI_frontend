import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockElectron } = vi.hoisted(() => ({
  mockElectron: {
    setBasePath: vi.fn(),
    reinstall: vi.fn<[], Promise<void>>().mockResolvedValue(undefined),
    uv: {
      installRequirements: vi.fn<[], Promise<void>>(),
      clearCache: vi.fn<[], Promise<void>>().mockResolvedValue(undefined),
      resetVenv: vi.fn<[], Promise<void>>().mockResolvedValue(undefined)
    }
  }
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: vi.fn(() => mockElectron)
}))

import { DESKTOP_MAINTENANCE_TASKS } from '@/constants/desktopMaintenanceTasks'

function findTask(id: string) {
  const task = DESKTOP_MAINTENANCE_TASKS.find((t) => t.id === id)
  if (!task) throw new Error(`Task not found: ${id}`)
  return task
}

describe('desktopMaintenanceTasks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(window, 'open').mockReturnValue(null)
    mockElectron.reinstall.mockResolvedValue(undefined)
    mockElectron.uv.clearCache.mockResolvedValue(undefined)
    mockElectron.uv.resetVenv.mockResolvedValue(undefined)
  })

  describe('pythonPackages', () => {
    it('returns true when installation succeeds', async () => {
      mockElectron.uv.installRequirements.mockResolvedValue(undefined)
      expect(await findTask('pythonPackages').execute()).toBe(true)
    })

    it('returns false when installation throws', async () => {
      mockElectron.uv.installRequirements.mockRejectedValue(
        new Error('install failed')
      )
      expect(await findTask('pythonPackages').execute()).toBe(false)
    })
  })

  describe('URL-opening tasks', () => {
    it('git execute opens a browser tab', () => {
      findTask('git').execute()
      expect(window.open).toHaveBeenCalledOnce()
    })

    it('uv execute opens a browser tab', () => {
      findTask('uv').execute()
      expect(window.open).toHaveBeenCalledOnce()
    })

    it('vcRedist execute opens a browser tab', () => {
      findTask('vcRedist').execute()
      expect(window.open).toHaveBeenCalledOnce()
    })
  })
})
