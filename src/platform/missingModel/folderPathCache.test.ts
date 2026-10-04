import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadFolderPathsOnce,
  resetFolderPathCache
} from '@/platform/missingModel/folderPathCache'
import { api } from '@/scripts/api'

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
  })

  it('does not cache a failure', async () => {
    const getFolderPaths = vi
      .spyOn(api, 'getFolderPaths')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ vae: ['/models/vae'] })

    await expect(loadFolderPathsOnce()).rejects.toThrow('offline')
    await expect(loadFolderPathsOnce()).resolves.toEqual({
      vae: ['/models/vae']
    })

    expect(getFolderPaths).toHaveBeenCalledTimes(2)
  })

  it('lets a rejection from before a reconnect leave the newer request alone', async () => {
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
    await expect(first).rejects.toThrow('socket closed')
    await expect(second).resolves.toEqual({ loras: ['/models/loras'] })

    // The stale rejection must not discard the request that replaced it: a
    // third caller shares the second request rather than opening a third.
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

    // A restarted backend may resolve different directories.
    expect(getFolderPaths).toHaveBeenCalledTimes(2)
  })
})
