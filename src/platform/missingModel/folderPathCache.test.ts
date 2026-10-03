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
