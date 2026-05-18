import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useResultGallery } from '@/composables/queue/useResultGallery'
import type { JobListItem as JobListViewItem } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'

const createResultItem = (
  filename: string,
  mediaType: string = 'images'
): ResultItemImpl => {
  const item = new ResultItemImpl({
    filename,
    subfolder: '',
    type: 'output',
    nodeId: 'node-1',
    mediaType
  })
  // Override url getter for test matching
  Object.defineProperty(item, 'url', { get: () => filename })
  return item
}

const createMockJob = (id: string, outputsCount = 1): JobListItem => ({
  id,
  status: 'completed',
  create_time: Date.now(),
  preview_output: null,
  outputs_count: outputsCount,
  priority: 0
})

const createTask = (
  preview?: ResultItemImpl,
  allOutputs?: ResultItemImpl[],
  outputsCount = 1
): TaskItemImpl => {
  const job = createMockJob(
    `task-${Math.random().toString(36).slice(2)}`,
    outputsCount
  )
  const flatOutputs = allOutputs ?? (preview ? [preview] : [])
  return new TaskItemImpl(job, {}, flatOutputs)
}

const createJobViewItem = (
  id: string,
  taskRef?: TaskItemImpl
): JobListViewItem =>
  ({
    id,
    title: `Job ${id}`,
    meta: '',
    state: 'completed',
    showClear: false,
    taskRef
  }) as JobListViewItem

describe('useResultGallery', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('falls back to all lightbox outputs and preserves their order', async () => {
    const lightboxOutputs = [
      createResultItem('p-1.png'),
      createResultItem('p-2.png')
    ]
    const nonLightbox = createResultItem('skip-me.bin', 'unknown')
    const tasks = [
      createTask(lightboxOutputs[0]),
      createTask(nonLightbox),
      createTask(lightboxOutputs[1]),
      createTask()
    ]

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    await onViewItem(createJobViewItem('job-1'))

    expect(galleryItems.value).toEqual(lightboxOutputs)
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('does not change state when there are no lightbox tasks', async () => {
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => []
    )

    await onViewItem(createJobViewItem('job-missing'))

    expect(galleryItems.value).toEqual([])
    expect(galleryActiveIndex.value).toBe(-1)
  })

  it('activates the inspected task output in the lightbox', async () => {
    const lightboxOutputs = [
      createResultItem('p-1.png'),
      createResultItem('p-2.png'),
      createResultItem('p-3.png')
    ]
    const tasks = lightboxOutputs.map((output) => createTask(output))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    await onViewItem(createJobViewItem('job-2', tasks[1]))

    expect(galleryItems.value).toEqual([lightboxOutputs[1]])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('defaults to the first entry when the clicked job lacks a task ref', async () => {
    const lightboxOutputs = [
      createResultItem('p-1.png'),
      createResultItem('p-2.png')
    ]
    const tasks = lightboxOutputs.map((output) => createTask(output))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    await onViewItem(createJobViewItem('job-no-preview'))

    expect(galleryItems.value).toEqual(lightboxOutputs)
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('defaults to the first entry when no gallery item matches the lightbox URL', async () => {
    const lightboxOutputs = [
      createResultItem('p-1.png'),
      createResultItem('p-2.png')
    ]
    const tasks = lightboxOutputs.map((output) => createTask(output))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    const taskWithMismatchedOutput = createTask(createResultItem('missing.png'))
    await onViewItem(
      createJobViewItem('job-mismatch', taskWithMismatchedOutput)
    )

    expect(galleryItems.value).toEqual([createResultItem('missing.png')])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('does not open for surfaced outputs that are not inspection targets', async () => {
    const nonLoadable3D = new ResultItemImpl({
      filename: 'asset.usdz',
      subfolder: '',
      type: 'output',
      nodeId: 'node-1',
      mediaType: '3D'
    })
    const task = createTask(nonLoadable3D)

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => [task]
    )

    await onViewItem(createJobViewItem('job-usdz', task))

    expect(galleryItems.value).toEqual([])
    expect(galleryActiveIndex.value).toBe(-1)
  })

  it('does not open lightbox for load3d targets', async () => {
    const load3d = new ResultItemImpl({
      filename: 'model.ply',
      subfolder: '',
      type: 'output',
      nodeId: 'node-1',
      mediaType: '3D'
    })
    const task = createTask(load3d)

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => [task]
    )

    await onViewItem(createJobViewItem('job-ply', task))

    expect(galleryItems.value).toEqual([])
    expect(galleryActiveIndex.value).toBe(-1)
  })

  it('does not fall back to unrelated outputs when target task has no lightbox target', async () => {
    const lightboxOutput = createResultItem('lightbox.png')
    const nonLightbox = createResultItem('not-lightbox.bin', 'unknown')
    const lightboxTask = createTask(lightboxOutput)
    const nonLightboxTask = createTask(nonLightbox)

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => [lightboxTask, nonLightboxTask]
    )

    await onViewItem(createJobViewItem('job-not-lightbox', nonLightboxTask))

    expect(galleryItems.value).toEqual([])
    expect(galleryActiveIndex.value).toBe(-1)
  })

  it('loads full outputs when task has only preview outputs', async () => {
    const previewOutput = createResultItem('preview-1.png')
    const fullOutputs = [
      createResultItem('full-1.png'),
      createResultItem('full-2.png'),
      createResultItem('full-3.png')
    ]

    // Create a task with outputsCount > 1 to trigger lazy loading
    const job = createMockJob('task-1', 3)
    const task = new TaskItemImpl(job, {}, [previewOutput])

    // Mock loadFullOutputs to return full outputs
    const loadedTask = new TaskItemImpl(job, {}, fullOutputs)
    task.loadFullOutputs = async () => loadedTask

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => [task]
    )

    await onViewItem(createJobViewItem('job-1', task))

    expect(galleryItems.value).toEqual(fullOutputs)
    expect(galleryActiveIndex.value).toBe(2)
  })
})
