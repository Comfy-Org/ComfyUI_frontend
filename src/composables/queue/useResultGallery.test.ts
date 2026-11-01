import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock(import('@/platform/assets/composables/media/assetMappers'))
vi.mock(import('@/services/hdrViewerService'))
vi.mock(import('@/services/jobOutputCache'), { spy: true })

import { useResultGallery } from '@/composables/queue/useResultGallery'
import { openHdrViewer } from '@/services/hdrViewerService'
import { getOutputsForTask } from '@/services/jobOutputCache'
import type { JobListItem as JobListViewItem } from '@/composables/queue/useJobList'
import type { JobListItem } from '@comfyorg/api-client/jobTypes'
import { TaskItemImpl } from '@/stores/queueStore'
import type { AugmentedResultItem } from '@/utils/resultItem'

const createResultItem = (
  url: string,
  supportsPreview = true
): AugmentedResultItem => ({
  filename: url,
  mediaType: supportsPreview ? 'images' : 'unknown',
  nodeId: 'node-1',
  subfolder: '',
  type: 'output',
  url
})

const createMockJob = (id: string, outputsCount = 1): JobListItem => ({
  id,
  status: 'completed',
  create_time: Date.now(),
  preview_output: null,
  outputs_count: outputsCount,
  priority: 0
})

const createTask = (
  preview?: AugmentedResultItem,
  allOutputs?: AugmentedResultItem[],
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
): JobListViewItem => ({
  id,
  title: `Job ${id}`,
  meta: '',
  state: 'completed',
  showClear: false,
  taskRef
})

describe('useResultGallery', () => {
  it('collects only previewable outputs and preserves their order', async () => {
    const previewable = [createResultItem('p-1'), createResultItem('p-2')]
    const nonPreviewable = createResultItem('skip-me', false)
    const tasks = [
      createTask(previewable[0]),
      createTask(nonPreviewable),
      createTask(previewable[1]),
      createTask()
    ]

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    await onViewItem(createJobViewItem('job-1', tasks[0]))

    expect(galleryItems.value).toEqual([previewable[0]])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('does not change state when there are no previewable tasks', async () => {
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => []
    )

    await onViewItem(createJobViewItem('job-missing'))

    expect(galleryItems.value).toEqual([])
    expect(galleryActiveIndex.value).toBe(-1)
  })

  it('activates the index that matches the viewed preview URL', async () => {
    const previewable = [
      createResultItem('p-1'),
      createResultItem('p-2'),
      createResultItem('p-3')
    ]
    const tasks = previewable.map((preview) => createTask(preview))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    await onViewItem(createJobViewItem('job-2', tasks[1]))

    expect(galleryItems.value).toEqual([previewable[1]])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('defaults to the first entry when the clicked job lacks a preview', async () => {
    const previewable = [createResultItem('p-1'), createResultItem('p-2')]
    const tasks = previewable.map((preview) => createTask(preview))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    await onViewItem(createJobViewItem('job-no-preview'))

    expect(galleryItems.value).toEqual(previewable)
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('defaults to the first entry when no gallery item matches the preview URL', async () => {
    const previewable = [createResultItem('p-1'), createResultItem('p-2')]
    const tasks = previewable.map((preview) => createTask(preview))

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => tasks
    )

    const taskWithMismatchedPreview = createTask(createResultItem('missing'))
    await onViewItem(
      createJobViewItem('job-mismatch', taskWithMismatchedPreview)
    )

    expect(galleryItems.value).toEqual([createResultItem('missing')])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('loads full outputs when task has only preview outputs', async () => {
    const previewOutput = createResultItem('preview-1')
    const fullOutputs = [
      createResultItem('full-1'),
      createResultItem('full-2'),
      createResultItem('full-3')
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
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('opens the HDR viewer for a job whose cover is HDR, even with image outputs', async () => {
    const image = createResultItem('image.png')
    const exr = {
      ...createResultItem('/api/view?filename=out.exr'),
      filename: 'out.exr'
    }
    const task = createTask(exr, [image, exr])

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => [task]
    )

    await onViewItem(createJobViewItem('job-mixed', task))

    expect(openHdrViewer).toHaveBeenCalledWith('/api/view?filename=out.exr')
    expect(galleryItems.value).toEqual([])
    expect(galleryActiveIndex.value).toBe(-1)
  })

  it('opens a job with an image cover in the gallery without its HDR outputs', async () => {
    const image = createResultItem('image.png')
    const exr = {
      ...createResultItem('/api/view?filename=out.exr'),
      filename: 'out.exr'
    }
    const task = createTask(image, [exr, image])

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => [task]
    )

    await onViewItem(createJobViewItem('job-mixed', task))

    expect(galleryItems.value).toEqual([image])
    expect(galleryActiveIndex.value).toBe(0)
    expect(openHdrViewer).not.toHaveBeenCalled()
  })

  it('ignores a stale async refresh that lands after the watcher claims sync items', async () => {
    const first = createResultItem('first.png')
    const job = createMockJob('stale-refresh-job', 2)
    const initialTask = new TaskItemImpl(job, {}, [first])
    let releaseRefresh!: (task: TaskItemImpl) => void
    initialTask.loadFullOutputs = () =>
      new Promise((resolve) => {
        releaseRefresh = resolve
      })

    const sources = ref([initialTask])
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => sources.value
    )
    const view = onViewItem(createJobViewItem('job-stale', initialTask))
    await Promise.resolve()

    const rerunTask = new TaskItemImpl(job, {}, [first, first])
    void onViewItem(createJobViewItem('job-stale', rerunTask))
    sources.value = [rerunTask]
    await Promise.resolve()
    releaseRefresh(new TaskItemImpl(job, {}, [first]))
    await view
    await Promise.resolve()

    expect(galleryItems.value).toEqual([first, first])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('keeps an open gallery closed when slow full outputs resolve after close', async () => {
    const image = createResultItem('image.png')
    const job = createMockJob('close-during-load', 2)
    const task = new TaskItemImpl(job, {}, [image])
    let release!: (task: TaskItemImpl) => void
    task.loadFullOutputs = () =>
      new Promise((resolve) => {
        release = resolve
      })

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => [task]
    )
    const view = onViewItem(createJobViewItem('job-close', task))
    await Promise.resolve()
    galleryActiveIndex.value = -1
    release(new TaskItemImpl(job, {}, [image, image]))
    await view

    expect(galleryItems.value).toEqual([image])
    expect(galleryActiveIndex.value).toBe(-1)
  })

  it('stays in the gallery when refresh surfaces HDR-first full outputs', async () => {
    const image = createResultItem('image.png')
    const exr = {
      ...createResultItem('/api/view?filename=out.exr'),
      filename: 'out.exr'
    }
    const job = createMockJob('hdr-refresh-job', 2)
    const task = new TaskItemImpl(job, {}, [image])
    let release!: (task: TaskItemImpl) => void
    task.loadFullOutputs = () =>
      new Promise((resolve) => {
        release = resolve
      })

    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => [task]
    )

    const view = onViewItem(createJobViewItem('job-hdr-refresh', task))
    await Promise.resolve()

    expect(galleryItems.value).toEqual([image])
    expect(galleryActiveIndex.value).toBe(0)

    release(new TaskItemImpl(job, {}, [exr, image]))
    await view
    await Promise.resolve()

    expect(openHdrViewer).not.toHaveBeenCalled()
    expect(galleryItems.value).toEqual([image])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('re-anchors the active item by URL when new items arrive while open', async () => {
    const first = createResultItem('first.png')
    const second = createResultItem('second.png')
    const job = createMockJob('reanchor-job', 1)
    const initialTask = new TaskItemImpl(job, {}, [first, second])
    const sources = ref([initialTask])
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => sources.value
    )

    await onViewItem(createJobViewItem('job-reanchor', initialTask))
    galleryActiveIndex.value = 1

    sources.value = [new TaskItemImpl(job, {}, [second, first])]
    await nextTick()
    await nextTick()

    expect(galleryItems.value).toEqual([second, first])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('keeps the selected output when the refreshed preview list omits it', async () => {
    const selected = createResultItem('selected.png')
    const first = createResultItem('first.png')
    const second = createResultItem('second.png')
    const jobId = 'retain-active-job'
    const initialTask = new TaskItemImpl(createMockJob(jobId, 1), {}, [
      selected
    ])
    const sources = ref([initialTask])
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => sources.value
    )

    await onViewItem(createJobViewItem('job-retain-active', initialTask))
    expect(galleryItems.value).toEqual([selected])
    expect(galleryItems.value.at(galleryActiveIndex.value)).toEqual(selected)

    const refreshedOutputs = [first, selected, second]
    const refreshedTask = new TaskItemImpl(createMockJob(jobId, 3), {}, [
      first,
      second
    ])
    refreshedTask.loadFullOutputs = async () =>
      new TaskItemImpl(createMockJob(jobId, 3), {}, refreshedOutputs)
    sources.value = [refreshedTask]
    await nextTick()
    await vi.waitFor(() => expect(galleryItems.value).toEqual(refreshedOutputs))

    expect(galleryItems.value.at(galleryActiveIndex.value)).toEqual(selected)
  })

  it('keeps the open gallery when the viewed task leaves the source list', async () => {
    const viewed = createResultItem('viewed.png')
    const viewedTask = createTask(viewed)
    const otherTask = createTask(createResultItem('other.png'))
    const sources = ref([viewedTask, otherTask])
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => sources.value
    )

    await onViewItem(createJobViewItem('job-viewed', viewedTask))
    expect(galleryItems.value).toEqual([viewed])

    sources.value = [otherTask]
    await nextTick()
    await nextTick()

    expect(galleryItems.value).toEqual([viewed])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('drops a refresh that predates a replacement task with no previews', async () => {
    const first = createResultItem('first.png')
    const stale = createResultItem('stale.png')
    const openTask = new TaskItemImpl(createMockJob('empty-rerun-job', 1), {}, [
      first
    ])
    let releaseStale!: (task: TaskItemImpl) => void
    const reloadedTask = new TaskItemImpl(
      createMockJob('empty-rerun-job', 2),
      {},
      [first]
    )
    reloadedTask.loadFullOutputs = () =>
      new Promise((resolve) => {
        releaseStale = resolve
      })
    const replacedTask = new TaskItemImpl(
      createMockJob('empty-rerun-job', 2),
      {},
      []
    )
    replacedTask.loadFullOutputs = () =>
      new Promise<TaskItemImpl>(() => undefined)

    const sources = ref([openTask])
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => sources.value
    )

    await onViewItem(createJobViewItem('job-empty-rerun', openTask))
    sources.value = [reloadedTask]
    await nextTick()
    sources.value = [replacedTask]
    await nextTick()
    await nextTick()

    releaseStale(
      new TaskItemImpl(createMockJob('empty-rerun-job', 2), {}, [stale])
    )
    await nextTick()
    await nextTick()

    expect(galleryItems.value).toEqual([first])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('skips loading full outputs when the viewed task now covers an HDR preview', async () => {
    const image = createResultItem('image.png')
    const exr = {
      ...createResultItem('/api/view?filename=out.exr'),
      filename: 'out.exr'
    }
    const job = createMockJob('hdr-watch-job', 2)
    const imageTask = new TaskItemImpl(job, {}, [image])
    imageTask.loadFullOutputs = async () => imageTask
    const sources = ref([imageTask])
    const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
      () => sources.value
    )

    await onViewItem(createJobViewItem('job-hdr-watch', imageTask))
    expect(galleryItems.value).toEqual([image])

    vi.mocked(getOutputsForTask).mockClear()
    sources.value = [new TaskItemImpl(job, {}, [image, exr])]
    await nextTick()
    await nextTick()

    expect(getOutputsForTask).not.toHaveBeenCalled()
    expect(galleryItems.value).toEqual([image])
    expect(galleryActiveIndex.value).toBe(0)
  })

  it('reloads a completed task after its running snapshot was opened', async () => {
    const preview = createResultItem('preview.png')
    const full = [
      createResultItem('full-1.png'),
      createResultItem('full-2.png')
    ]
    const jobId = 'completing-job'
    const runningTask = new TaskItemImpl(
      { ...createMockJob(jobId, 3), status: 'in_progress' },
      {},
      [preview]
    )
    const sources = ref([runningTask])
    const { galleryItems, onViewItem } = useResultGallery(() => sources.value)

    await onViewItem(createJobViewItem('job-completing', runningTask))
    expect(galleryItems.value).toEqual([preview])

    const completedTask = new TaskItemImpl(
      { ...createMockJob(jobId, 3), status: 'completed' },
      {},
      full
    )
    let finishLoadingOutputs!: () => void
    completedTask.loadFullOutputs = () =>
      new Promise<TaskItemImpl>((resolve) => {
        finishLoadingOutputs = () => resolve(completedTask)
      })
    sources.value = [completedTask]
    await nextTick()
    expect(galleryItems.value).toContain(preview)

    finishLoadingOutputs()
    await vi.waitFor(() => expect(galleryItems.value).toEqual(full))
  })

  it.for(['resolves', 'rejects'])(
    'does not open a slower gallery request that %s over a later HDR selection',
    async (outcome) => {
      const image = createResultItem('image.png')
      const exr = {
        ...createResultItem('/api/view?filename=out.exr'),
        filename: 'out.exr'
      }
      const imageJob = createMockJob(`slow-image-job-${outcome}`, 2)
      const imageTask = new TaskItemImpl(imageJob, {}, [image])
      let settle!: () => void
      imageTask.loadFullOutputs = () =>
        new Promise((resolve, reject) => {
          settle = () =>
            outcome === 'resolves'
              ? resolve(new TaskItemImpl(imageJob, {}, [image, image]))
              : reject(new Error('load failed'))
        })
      const hdrTask = createTask(exr)

      const { galleryItems, galleryActiveIndex, onViewItem } = useResultGallery(
        () => [imageTask, hdrTask]
      )

      const imageView = onViewItem(createJobViewItem('job-image', imageTask))
      await onViewItem(createJobViewItem('job-hdr', hdrTask))
      settle()
      await imageView

      expect(openHdrViewer).toHaveBeenCalledOnce()
      expect(galleryItems.value).toEqual([])
      expect(galleryActiveIndex.value).toBe(-1)
    }
  )
})
