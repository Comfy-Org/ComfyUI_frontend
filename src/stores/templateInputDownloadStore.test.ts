import type { ComfyTemplateInputDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useTemplateInputDownloadStore } from './templateInputDownloadStore'

function progress(
  status: ComfyTemplateInputDownloadProgress['status'],
  value: number
): ComfyTemplateInputDownloadProgress {
  return {
    downloadId: 'download-1',
    filename: 'subject.png',
    progress: value,
    status,
    templateInputs: [{ templateId: 'template-a', assetId: 'asset-a' }]
  }
}

describe('useTemplateInputDownloadStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps completion blocking until graph hydration and busts preview cache once', () => {
    const store = useTemplateInputDownloadStore()

    store.updateProgress(progress('downloading', 0.4))
    expect(store.downloads[0]).toMatchObject({
      filename: 'subject.png',
      progress: 0.4,
      status: 'downloading'
    })
    expect(store.blockingFilenames).toEqual(new Set(['subject.png']))

    store.updateProgress(progress('completed', 1))
    store.updateProgress(progress('completed', 1))
    expect(store.previewRevision('subject.png')).toBe(1)
    expect(store.blockingFilenames).toEqual(new Set(['subject.png']))

    store.completeGraphSync(['subject.png'])
    expect(store.downloads).toEqual([])
    expect(store.previewRevision('subject.png')).toBe(1)
  })
})
