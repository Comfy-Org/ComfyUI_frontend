import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadFolderPathsOnce,
  resetFolderPathCache
} from '@/platform/missingModel/folderPathCache'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

vi.mock(import('@/platform/telemetry/reportError'))

describe('loadFolderPathsOnce', () => {
  beforeEach(() => {
    resetFolderPathCache()
  })

  it('asks the backend once and shares the answer', async () => {
    const paths = { checkpoints: ['/models/checkpoints'] }
    const getFolderPaths = vi
      .spyOn(api, 'getFolderPaths')
      .mockResolvedValue(paths)

    await expect(
      Promise.all([loadFolderPathsOnce(), loadFolderPathsOnce()])
    ).resolves.toEqual([paths, paths])
    await expect(loadFolderPathsOnce()).resolves.toBe(paths)

    expect(getFolderPaths).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('resolves undefined on failure, reports it once, and retries next time', async () => {
    const failure = new Error('offline')
    const getFolderPaths = vi
      .spyOn(api, 'getFolderPaths')
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ vae: ['/models/vae'] })

    await expect(
      Promise.all([loadFolderPathsOnce(), loadFolderPathsOnce()])
    ).resolves.toEqual([undefined, undefined])
    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(failure, {
      errorType: 'failure_loading_folder_paths',
      surface: 'platform'
    })

    await expect(loadFolderPathsOnce()).resolves.toEqual({
      vae: ['/models/vae']
    })
    expect(getFolderPaths).toHaveBeenCalledTimes(2)
  })

  it('lets a failure from before a reconnect leave the newer request alone', async () => {
    let rejectStale!: (reason: Error) => void
    const stale = new Promise<Record<string, string[]>>((_, reject) => {
      rejectStale = reject
    })
    const getFolderPaths = vi
      .spyOn(api, 'getFolderPaths')
      .mockReturnValueOnce(stale)
      .mockResolvedValue({ loras: ['/models/loras'] })

    const first = loadFolderPathsOnce()
    api.dispatchCustomEvent('reconnected')
    const second = loadFolderPathsOnce()

    rejectStale(new Error('socket closed'))
    await expect(first).resolves.toBeUndefined()
    await expect(second).resolves.toEqual({ loras: ['/models/loras'] })

    await expect(loadFolderPathsOnce()).resolves.toEqual({
      loras: ['/models/loras']
    })
    expect(getFolderPaths).toHaveBeenCalledTimes(2)
  })

  it('asks again after the backend reconnects', async () => {
    const getFolderPaths = vi
      .spyOn(api, 'getFolderPaths')
      .mockResolvedValue({ loras: ['/models/loras'] })

    await loadFolderPathsOnce()
    api.dispatchCustomEvent('reconnected')
    await loadFolderPathsOnce()

    expect(getFolderPaths).toHaveBeenCalledTimes(2)
  })
})
