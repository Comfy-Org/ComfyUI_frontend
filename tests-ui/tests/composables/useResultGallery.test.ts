import { describe, it, expect } from 'vitest'

import { useResultGallery } from '@/composables/queue/useResultGallery'
import type { JobListItem } from '@/composables/queue/useJobList'
import type { ResultItemImpl } from '@/stores/queueStore'

type PreviewLike = Pick<ResultItemImpl, 'url' | 'supportsPreview'>

/**
 * Mock task interface matching what useResultGallery expects.
 * Uses structural typing - no need to import the internal GalleryTask type.
 */
interface MockTask {
  readonly promptId: string
  readonly outputsCount?: number
  readonly flatOutputs: readonly ResultItemImpl[]
  readonly previewOutput?: ResultItemImpl
  loadFullOutputs(
    fetchApi: (url: string) => Promise<Response>
  ): Promise<MockTask>
}

const createPreview = (url: string, supportsPreview = true): PreviewLike => ({
  url,
  supportsPreview
})

const createMockTask = (
  preview?: PreviewLike,
  allOutputs?: PreviewLike[]
): MockTask => ({
  previewOutput: preview as ResultItemImpl | undefined,
  flatOutputs: (allOutputs ?? (preview ? [preview] : [])) as ResultItemImpl[],
  outputsCount: 1,
  promptId: `task-${Math.random().toString(36).slice(2)}`,
  loadFullOutputs: async () => createMockTask(preview, allOutputs)
})

const createJobItem = (
  id: string,
  preview?: PreviewLike,
  taskRef?: MockTask
): JobListItem =>
  ({
    id,
    title: `Job ${id}`,
    meta: '',
    state: 'completed',
    showClear: false,
    taskRef: taskRef ?? (preview ? { previewOutput: preview } : undefined)
  }) as JobListItem

describe('useResultGallery', () => {
  it('collects only previewable outputs and preserves their order', async () => {
    const previewable = [createPreview('p-1'), createPreview('p-2')]
    const nonPreviewable = { url: 'skip-me', supportsPreview: false }
    const tasks = [
      createMockTask(previewable[0]),
      createMockTask(nonPreviewable),
      createMockTask(previewable[1]),
      createMockTask()
    ]

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    await onViewItem(createJobItem('job-1', previewable[0], tasks[0]))

    expect(galleryItems.value).toEqual([previewable[0]])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('does not change state when there are no previewable tasks', async () => {
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => []
    )

    await onViewItem(createJobItem('job-missing'))

    expect(galleryItems.value).toEqual([])
    expect(galleryActiveIndex.value).toBe(-1)
  })

  it('activates the index that matches the viewed preview URL', async () => {
    const previewable = [
      createPreview('p-1'),
      createPreview('p-2'),
      createPreview('p-3')
    ]
    const tasks = previewable.map((preview) => createMockTask(preview))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    const targetPreview = createPreview('p-2')
    await onViewItem(createJobItem('job-2', targetPreview, tasks[1]))

    expect(galleryItems.value).toEqual([previewable[1]])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('defaults to the first entry when the clicked job lacks a preview', async () => {
    const previewable = [createPreview('p-1'), createPreview('p-2')]
    const tasks = previewable.map((preview) => createMockTask(preview))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    await onViewItem(createJobItem('job-no-preview'))

    expect(galleryItems.value).toEqual(previewable)
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('defaults to the first entry when no gallery item matches the preview URL', async () => {
    const previewable = [createPreview('p-1'), createPreview('p-2')]
    const tasks = previewable.map((preview) => createMockTask(preview))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    await onViewItem(createJobItem('job-mismatch', createPreview('missing')))

    expect(galleryItems.value).toEqual(previewable)
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('loads full outputs when task has only preview outputs', async () => {
    const previewOutput = createPreview('preview-1')
    const fullOutputs = [
      createPreview('full-1'),
      createPreview('full-2'),
      createPreview('full-3')
    ] as ResultItemImpl[]

    const mockTask: MockTask = {
      promptId: 'task-1',
      previewOutput: previewOutput as ResultItemImpl,
      flatOutputs: [previewOutput] as ResultItemImpl[],
      outputsCount: 3, // More than 1 triggers lazy loading
      loadFullOutputs: async () => ({
        promptId: 'task-1',
        previewOutput: previewOutput as ResultItemImpl,
        flatOutputs: fullOutputs,
        outputsCount: 3,
        loadFullOutputs: async () => mockTask
      })
    }

    const mockFetchApi = async () => new Response()

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => [mockTask],
      mockFetchApi
    )

    await onViewItem(createJobItem('job-1', previewOutput, mockTask))

    expect(galleryItems.value).toEqual(fullOutputs)
    expect(galleryActiveIndex.value).toBe(0)
  })
})
