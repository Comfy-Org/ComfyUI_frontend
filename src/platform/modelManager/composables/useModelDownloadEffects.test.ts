import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompletedDownload } from '../stores/modelDownloadStore'
import { useModelDownloadEffects } from './useModelDownloadEffects'

const mockLastCompletedDownload = ref<CompletedDownload | null>(null)
const mockRefreshModelFolder = vi.fn()
const mockRefreshMissingModels = vi.fn()

vi.mock('../stores/modelDownloadStore', () => ({
  useModelDownloadStore: () => ({
    get lastCompletedDownload() {
      return mockLastCompletedDownload.value
    }
  })
}))

vi.mock('@/stores/modelStore', () => ({
  useModelStore: () => ({ refreshModelFolder: mockRefreshModelFolder })
}))

vi.mock('@/platform/missingModel/missingModelStore', () => ({
  useMissingModelStore: () => ({
    refreshMissingModels: mockRefreshMissingModels
  })
}))

describe('useModelDownloadEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLastCompletedDownload.value = null
    mockRefreshModelFolder.mockResolvedValue(undefined)
  })

  it('does nothing until a download completes', () => {
    useModelDownloadEffects()

    expect(mockRefreshModelFolder).not.toHaveBeenCalled()
    expect(mockRefreshMissingModels).not.toHaveBeenCalled()
  })

  it('refreshes the model folder and re-scans missing models on completion', async () => {
    useModelDownloadEffects()

    mockLastCompletedDownload.value = {
      downloadId: 'd1',
      modelId: 'loras/x.safetensors',
      directory: 'loras',
      timestamp: 1
    }

    await vi.waitFor(() => {
      expect(mockRefreshModelFolder).toHaveBeenCalledWith('loras')
    })
    expect(mockRefreshMissingModels).toHaveBeenCalled()
  })

  it('skips the folder refresh when the directory is unknown', async () => {
    useModelDownloadEffects()

    mockLastCompletedDownload.value = {
      downloadId: 'd1',
      modelId: 'unknown.safetensors',
      directory: '',
      timestamp: 1
    }

    await vi.waitFor(() => {
      expect(mockRefreshMissingModels).toHaveBeenCalled()
    })
    expect(mockRefreshModelFolder).not.toHaveBeenCalled()
  })

  it('still re-scans missing models when the folder refresh fails', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockRefreshModelFolder.mockRejectedValue(new Error('boom'))
    useModelDownloadEffects()

    mockLastCompletedDownload.value = {
      downloadId: 'd1',
      modelId: 'loras/x.safetensors',
      directory: 'loras',
      timestamp: 1
    }

    await vi.waitFor(() => {
      expect(mockRefreshMissingModels).toHaveBeenCalled()
    })
    expect(consoleWarn).toHaveBeenCalled()
    consoleWarn.mockRestore()
  })
})
