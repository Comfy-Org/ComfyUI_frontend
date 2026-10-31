import type { ComfyTemplateInputDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
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
  beforeEach(() => useTemplateInputDownloadStore().clear())

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
  it.for(['error', 'cancelled'] as const)(
    'drops a download that ends as %s',
    (status) => {
      const store = useTemplateInputDownloadStore()

      store.updateProgress(progress('downloading', 0.4))
      expect(store.downloads).toHaveLength(1)

      store.updateProgress(progress(status, 0.4))
      expect(store.downloads).toEqual([])
      expect(store.blockingFilenames).toEqual(new Set())
    }
  )

  it.for([
    { name: 'above one', value: 2 },
    { name: 'below zero', value: -1 },
    { name: 'not finite', value: Number.NaN }
  ])('reports a progress $name as unknown', ({ value }) => {
    const store = useTemplateInputDownloadStore()

    store.updateProgress(progress('downloading', value))

    expect(store.downloads[0].progress).toBeNull()
  })

  it('tracks concurrent downloads separately', () => {
    const store = useTemplateInputDownloadStore()

    store.updateProgress(progress('downloading', 0.2))
    store.updateProgress({
      ...progress('downloading', 0.8),
      downloadId: 'download-2',
      filename: 'backdrop.png'
    })

    expect(store.downloads).toHaveLength(2)
    expect(store.blockingFilenames).toEqual(
      new Set(['subject.png', 'backdrop.png'])
    )
  })

  it('forgets everything on clear', () => {
    const store = useTemplateInputDownloadStore()

    store.updateProgress(progress('completed', 1))
    expect(store.previewRevision('subject.png')).toBe(1)

    store.clear()

    expect(store.downloads).toEqual([])
    expect(store.previewRevision('subject.png')).toBe(0)
  })

  it('does not resurrect a download after its graph sync completed', () => {
    const store = useTemplateInputDownloadStore()

    store.updateProgress(progress('completed', 1))
    store.completeGraphSync(['subject.png'])
    expect(store.downloads).toEqual([])

    store.updateProgress(progress('completed', 1))

    expect(store.downloads).toEqual([])
    expect(store.blockingFilenames).toEqual(new Set())
  })

  it('ignores a late in-flight event for a download that already finished', () => {
    const store = useTemplateInputDownloadStore()

    store.updateProgress(progress('completed', 1))
    store.completeGraphSync(['subject.png'])

    store.updateProgress(progress('downloading', 0.5))

    // Re-added, the record is no longer `completed`, so `completeGraphSync`
    // cannot clear it and the filename stays blocked for the session.
    expect(store.downloads).toEqual([])
    expect(store.blockingFilenames).toEqual(new Set())
  })
})
