import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useJobPreviewStore } from '@/stores/jobPreviewStore'
import { releaseSharedObjectUrl } from '@/utils/objectUrlUtil'

const previewMethodRef = ref('latent2rgb')

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => {
      if (key === 'Comfy.Execution.PreviewMethod') return previewMethodRef.value
      return undefined
    }
  })
}))

vi.mock('@/utils/objectUrlUtil', () => ({
  retainSharedObjectUrl: vi.fn(),
  releaseSharedObjectUrl: vi.fn()
}))

describe('jobPreviewStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    previewMethodRef.value = 'latent2rgb'
  })

  it('stores preview with nodeId', () => {
    const store = useJobPreviewStore()
    store.setPreviewUrl('prompt-1', 'blob:url-1', 'node-5')

    expect(store.nodePreviewsByPromptId['prompt-1']).toEqual({
      url: 'blob:url-1',
      nodeId: 'node-5'
    })
  })

  it('stores preview without nodeId', () => {
    const store = useJobPreviewStore()
    store.setPreviewUrl('prompt-1', 'blob:url-1')

    expect(store.nodePreviewsByPromptId['prompt-1']).toEqual({
      url: 'blob:url-1',
      nodeId: undefined
    })
  })

  it('derives previewsByPromptId as url-only map', () => {
    const store = useJobPreviewStore()
    store.setPreviewUrl('p1', 'blob:a', 'node-1')
    store.setPreviewUrl('p2', 'blob:b', 'node-2')

    expect(store.previewsByPromptId).toEqual({
      p1: 'blob:a',
      p2: 'blob:b'
    })
  })

  it('clears a single preview', () => {
    const store = useJobPreviewStore()
    store.setPreviewUrl('p1', 'blob:a', 'node-1')
    store.setPreviewUrl('p2', 'blob:b', 'node-2')

    store.clearPreview('p1')

    expect(store.nodePreviewsByPromptId['p1']).toBeUndefined()
    expect(store.nodePreviewsByPromptId['p2']).toBeDefined()
    expect(store.previewsByPromptId).toEqual({ p2: 'blob:b' })
  })

  it('clears all previews', () => {
    const store = useJobPreviewStore()
    store.setPreviewUrl('p1', 'blob:a', 'node-1')
    store.setPreviewUrl('p2', 'blob:b', 'node-2')

    store.clearAllPreviews()

    expect(store.nodePreviewsByPromptId).toEqual({})
    expect(store.previewsByPromptId).toEqual({})
  })

  it('skips duplicate url', () => {
    const store = useJobPreviewStore()
    store.setPreviewUrl('p1', 'blob:a', 'node-1')

    store.setPreviewUrl('p1', 'blob:a', 'node-1')

    expect(releaseSharedObjectUrl).not.toHaveBeenCalled()
  })

  it('ignores setPreviewUrl when previews are disabled', () => {
    previewMethodRef.value = 'none'
    const store = useJobPreviewStore()

    store.setPreviewUrl('p1', 'blob:a', 'node-1')

    expect(store.nodePreviewsByPromptId).toEqual({})
  })
})
