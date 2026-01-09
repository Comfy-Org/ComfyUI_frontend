import { describe, it, expect } from 'vitest'

import { useResultGallery } from '@/queue/composables/useResultGallery'
import type { JobListItem } from '@/queue/composables/useJobList'

type PreviewLike = { url: string; supportsPreview: boolean }

const createPreview = (url: string, supportsPreview = true): PreviewLike => ({
  url,
  supportsPreview
})

const createTask = (preview?: PreviewLike) => ({
  previewOutput: preview
})

const createJobItem = (id: string, preview?: PreviewLike): JobListItem =>
  ({
    id,
    title: `Job ${id}`,
    meta: '',
    state: 'completed',
    showClear: false,
    taskRef: preview ? { previewOutput: preview } : undefined
  }) as JobListItem

describe('useResultGallery', () => {
  it('collects only previewable outputs and preserves their order', () => {
    const previewable = [createPreview('p-1'), createPreview('p-2')]
    const tasks = [
      createTask(previewable[0]),
      createTask({ url: 'skip-me', supportsPreview: false }),
      createTask(previewable[1]),
      createTask()
    ]

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    onViewItem(createJobItem('job-1', previewable[0]))

    expect(galleryItems.value).toEqual(previewable)
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('does not change state when there are no previewable tasks', () => {
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => []
    )

    onViewItem(createJobItem('job-missing'))

    expect(galleryItems.value).toEqual([])
    expect(galleryActiveIndex.value).toBe(-1)
  })

  it('activates the index that matches the viewed preview URL', () => {
    const previewable = [
      createPreview('p-1'),
      createPreview('p-2'),
      createPreview('p-3')
    ]
    const tasks = previewable.map((preview) => createTask(preview))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    onViewItem(createJobItem('job-2', createPreview('p-2')))

    expect(galleryItems.value).toEqual(previewable)
    expect(galleryActiveIndex.value).toBe(1)
  })

  it('defaults to the first entry when the clicked job lacks a preview', () => {
    const previewable = [createPreview('p-1'), createPreview('p-2')]
    const tasks = previewable.map((preview) => createTask(preview))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    onViewItem(createJobItem('job-no-preview'))

    expect(galleryItems.value).toEqual(previewable)
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('defaults to the first entry when no gallery item matches the preview URL', () => {
    const previewable = [createPreview('p-1'), createPreview('p-2')]
    const tasks = previewable.map((preview) => createTask(preview))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    onViewItem(createJobItem('job-mismatch', createPreview('missing')))

    expect(galleryItems.value).toEqual(previewable)
    expect(galleryActiveIndex.value).toBe(0)
  })
})
