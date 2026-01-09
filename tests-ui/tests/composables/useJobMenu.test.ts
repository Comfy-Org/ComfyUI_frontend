import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import type { JobListItem } from '@/queue/composables/useJobList'
import type { MenuEntry } from '@/queue/composables/useJobMenu'

const downloadFileMock = vi.fn()
vi.mock('@/base/common/downloadUtil', () => ({
  downloadFile: (...args: any[]) => downloadFileMock(...args)
}))

const copyToClipboardMock = vi.fn()
vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: (...args: any[]) => copyToClipboardMock(...args)
  })
}))

const stMock = vi.fn((_: string, fallback?: string) => fallback ?? _)
const tMock = vi.fn((key: string) => `i18n:${key}`)
vi.mock('@/i18n', () => ({
  st: (...args: Parameters<typeof stMock>) => stMock(...args),
  t: (...args: Parameters<typeof tMock>) => tMock(...args)
}))

const mapTaskOutputToAssetItemMock = vi.fn()
vi.mock('@/platform/assets/composables/media/assetMappers', () => ({
  mapTaskOutputToAssetItem: (...args: any[]) =>
    mapTaskOutputToAssetItemMock(...args)
}))

const mediaAssetActionsMock = {
  confirmDelete: vi.fn()
}
vi.mock('@/platform/assets/composables/useMediaAssetActions', () => ({
  useMediaAssetActions: () => mediaAssetActionsMock
}))

const settingStoreMock = {
  get: vi.fn()
}
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => settingStoreMock
}))

const workflowServiceMock = {
  openWorkflow: vi.fn()
}
vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => workflowServiceMock
}))

const workflowStoreMock = {
  createTemporary: vi.fn()
}
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => workflowStoreMock
}))

const interruptMock = vi.fn()
const deleteItemMock = vi.fn()
vi.mock('@/scripts/api', () => ({
  api: {
    interrupt: (...args: any[]) => interruptMock(...args),
    deleteItem: (...args: any[]) => deleteItemMock(...args)
  }
}))

const downloadBlobMock = vi.fn()
vi.mock('@/scripts/utils', () => ({
  downloadBlob: (...args: any[]) => downloadBlobMock(...args)
}))

const dialogServiceMock = {
  showExecutionErrorDialog: vi.fn(),
  prompt: vi.fn()
}
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => dialogServiceMock
}))

const litegraphServiceMock = {
  addNodeOnGraph: vi.fn(),
  getCanvasCenter: vi.fn()
}
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => litegraphServiceMock
}))

const nodeDefStoreMock = {
  nodeDefsByName: {} as Record<string, any>
}
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => nodeDefStoreMock
}))

const queueStoreMock = {
  update: vi.fn(),
  delete: vi.fn()
}
vi.mock('@/queue/stores/queueStore', () => ({
  useQueueStore: () => queueStoreMock
}))

const createAnnotatedPathMock = vi.fn()
vi.mock('@/utils/createAnnotatedPath', () => ({
  createAnnotatedPath: (...args: any[]) => createAnnotatedPathMock(...args)
}))

const appendJsonExtMock = vi.fn((value: string) =>
  value.toLowerCase().endsWith('.json') ? value : `${value}.json`
)
vi.mock('@/utils/formatUtil', () => ({
  appendJsonExt: (...args: Parameters<typeof appendJsonExtMock>) =>
    appendJsonExtMock(...args)
}))

import { useJobMenu } from '@/queue/composables/useJobMenu'

const createJobItem = (overrides: Partial<JobListItem> = {}): JobListItem => ({
  id: overrides.id ?? 'job-1',
  title: overrides.title ?? 'Test job',
  meta: overrides.meta ?? 'meta',
  state: overrides.state ?? 'completed',
  taskRef: overrides.taskRef,
  iconName: overrides.iconName,
  iconImageUrl: overrides.iconImageUrl,
  showClear: overrides.showClear,
  progressCurrentPercent: overrides.progressCurrentPercent,
  progressTotalPercent: overrides.progressTotalPercent,
  runningNodeName: overrides.runningNodeName,
  executionTimeMs: overrides.executionTimeMs,
  computeHours: overrides.computeHours
})

let currentItem: Ref<JobListItem | null>

const mountJobMenu = (onInspectAsset?: (item: JobListItem) => void) =>
  useJobMenu(() => currentItem.value, onInspectAsset)

const findActionEntry = (entries: MenuEntry[], key: string) =>
  entries.find(
    (entry): entry is Extract<MenuEntry, { kind?: 'item' }> =>
      entry.key === key && entry.kind !== 'divider'
  )

describe('useJobMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentItem = ref<JobListItem | null>(null)
    settingStoreMock.get.mockReturnValue(false)
    dialogServiceMock.prompt.mockResolvedValue(undefined)
    litegraphServiceMock.getCanvasCenter.mockReturnValue([100, 200])
    litegraphServiceMock.addNodeOnGraph.mockReturnValue(null)
    workflowStoreMock.createTemporary.mockImplementation((filename, data) => ({
      filename,
      data
    }))
    queueStoreMock.update.mockResolvedValue(undefined)
    queueStoreMock.delete.mockResolvedValue(undefined)
    mediaAssetActionsMock.confirmDelete.mockResolvedValue(false)
    mapTaskOutputToAssetItemMock.mockImplementation((task, output) => ({
      task,
      output
    }))
    createAnnotatedPathMock.mockReturnValue('annotated-path')
    nodeDefStoreMock.nodeDefsByName = {
      LoadImage: { id: 'LoadImage' },
      LoadVideo: { id: 'LoadVideo' },
      LoadAudio: { id: 'LoadAudio' }
    }
  })

  const setCurrentItem = (item: JobListItem | null) => {
    currentItem.value = item
  }

  it('opens workflow when workflow data exists', async () => {
    const { openJobWorkflow } = mountJobMenu()
    const workflow = { nodes: [] }
    setCurrentItem(createJobItem({ id: '55', taskRef: { workflow } }))

    await openJobWorkflow()

    expect(workflowStoreMock.createTemporary).toHaveBeenCalledWith(
      'Job 55.json',
      workflow
    )
    expect(workflowServiceMock.openWorkflow).toHaveBeenCalledWith({
      filename: 'Job 55.json',
      data: workflow
    })
  })

  it('does nothing when workflow is missing', async () => {
    const { openJobWorkflow } = mountJobMenu()
    setCurrentItem(createJobItem({ taskRef: {} }))

    await openJobWorkflow()

    expect(workflowStoreMock.createTemporary).not.toHaveBeenCalled()
    expect(workflowServiceMock.openWorkflow).not.toHaveBeenCalled()
  })

  it('copies job id to clipboard', async () => {
    const { copyJobId } = mountJobMenu()
    setCurrentItem(createJobItem({ id: 'job-99' }))

    await copyJobId()

    expect(copyToClipboardMock).toHaveBeenCalledWith('job-99')
  })

  it('ignores copy job id when no selection', async () => {
    const { copyJobId } = mountJobMenu()

    await copyJobId()

    expect(copyToClipboardMock).not.toHaveBeenCalled()
  })

  it.each([
    ['running', interruptMock, deleteItemMock],
    ['initialization', interruptMock, deleteItemMock]
  ])('cancels %s job via interrupt', async (state) => {
    const { cancelJob } = mountJobMenu()
    setCurrentItem(createJobItem({ state: state as any }))

    await cancelJob()

    expect(interruptMock).toHaveBeenCalledWith('job-1')
    expect(deleteItemMock).not.toHaveBeenCalled()
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('cancels pending job via deleteItem', async () => {
    const { cancelJob } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'pending' }))

    await cancelJob()

    expect(deleteItemMock).toHaveBeenCalledWith('queue', 'job-1')
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('still updates queue for uncancellable states', async () => {
    const { cancelJob } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'completed' }))

    await cancelJob()

    expect(interruptMock).not.toHaveBeenCalled()
    expect(deleteItemMock).not.toHaveBeenCalled()
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('copies error message from failed job entry', async () => {
    const { jobMenuEntries } = mountJobMenu()
    const error = { exception_message: 'boom' }
    setCurrentItem(
      createJobItem({
        state: 'failed',
        taskRef: { status: { messages: [['execution_error', error]] } } as any
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'copy-error')
    await entry?.onClick?.()

    expect(copyToClipboardMock).toHaveBeenCalledWith('boom')
  })

  it('reports error via dialog when entry triggered', async () => {
    const { jobMenuEntries } = mountJobMenu()
    const error = { exception_message: 'bad', extra: 1 }
    setCurrentItem(
      createJobItem({
        state: 'failed',
        taskRef: { status: { messages: [['execution_error', error]] } } as any
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'report-error')
    entry?.onClick?.()

    expect(dialogServiceMock.showExecutionErrorDialog).toHaveBeenCalledWith(
      error
    )
  })

  it('ignores error actions when message missing', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'failed', taskRef: { status: {} } }))

    await nextTick()
    const copyEntry = findActionEntry(jobMenuEntries.value, 'copy-error')
    await copyEntry?.onClick?.()
    const reportEntry = findActionEntry(jobMenuEntries.value, 'report-error')
    await reportEntry?.onClick?.()

    expect(copyToClipboardMock).not.toHaveBeenCalled()
    expect(dialogServiceMock.showExecutionErrorDialog).not.toHaveBeenCalled()
  })

  const previewCases = [
    {
      label: 'image',
      flags: { isImage: true },
      expectedNode: 'LoadImage',
      widget: 'image'
    },
    {
      label: 'video',
      flags: { isVideo: true },
      expectedNode: 'LoadVideo',
      widget: 'file'
    },
    {
      label: 'audio',
      flags: { isAudio: true },
      expectedNode: 'LoadAudio',
      widget: 'audio'
    }
  ] as const

  it.each(previewCases)(
    'adds loader node for %s preview output',
    async ({ flags, expectedNode, widget }) => {
      const widgetCallback = vi.fn()
      const node = {
        widgets: [{ name: widget, value: null, callback: widgetCallback }],
        graph: { setDirtyCanvas: vi.fn() }
      }
      litegraphServiceMock.addNodeOnGraph.mockReturnValueOnce(node)
      const { jobMenuEntries } = mountJobMenu()
      const preview = {
        filename: 'foo.png',
        subfolder: 'bar',
        type: 'output',
        url: 'http://asset',
        ...flags
      }
      setCurrentItem(
        createJobItem({
          state: 'completed',
          taskRef: { previewOutput: preview }
        })
      )

      await nextTick()
      const entry = findActionEntry(jobMenuEntries.value, 'add-to-current')
      await entry?.onClick?.()

      expect(litegraphServiceMock.addNodeOnGraph).toHaveBeenCalledWith(
        nodeDefStoreMock.nodeDefsByName[expectedNode],
        { pos: [100, 200] }
      )
      expect(node.widgets?.[0].value).toBe('annotated-path')
      expect(widgetCallback).toHaveBeenCalledWith('annotated-path')
      expect(node.graph?.setDirtyCanvas).toHaveBeenCalledWith(true, true)
    }
  )

  it('skips adding node when no loader definition', async () => {
    delete nodeDefStoreMock.nodeDefsByName.LoadImage
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        state: 'completed',
        taskRef: {
          previewOutput: {
            isImage: true,
            filename: 'foo',
            subfolder: '',
            type: 'output'
          }
        }
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'add-to-current')
    await entry?.onClick?.()

    expect(litegraphServiceMock.addNodeOnGraph).not.toHaveBeenCalled()
  })

  it('skips adding node when preview output lacks media flags', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        state: 'completed',
        taskRef: {
          previewOutput: {
            filename: 'foo',
            subfolder: 'bar',
            type: 'output'
          }
        }
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'add-to-current')
    await entry?.onClick?.()

    expect(litegraphServiceMock.addNodeOnGraph).not.toHaveBeenCalled()
    expect(createAnnotatedPathMock).not.toHaveBeenCalled()
  })

  it('skips annotating when litegraph node creation fails', async () => {
    litegraphServiceMock.addNodeOnGraph.mockReturnValueOnce(null)
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        state: 'completed',
        taskRef: {
          previewOutput: {
            isImage: true,
            filename: 'foo',
            subfolder: '',
            type: 'output'
          }
        }
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'add-to-current')
    await entry?.onClick?.()

    expect(litegraphServiceMock.addNodeOnGraph).toHaveBeenCalled()
    expect(createAnnotatedPathMock).not.toHaveBeenCalled()
  })

  it('ignores add-to-current entry when preview missing entirely', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'completed', taskRef: {} as any }))

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'add-to-current')
    await entry?.onClick?.()

    expect(litegraphServiceMock.addNodeOnGraph).not.toHaveBeenCalled()
  })

  it('downloads preview asset when requested', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        state: 'completed',
        taskRef: {
          previewOutput: { url: 'https://asset', isImage: true }
        }
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'download')
    entry?.onClick?.()

    expect(downloadFileMock).toHaveBeenCalledWith('https://asset')
  })

  it('ignores download request when preview missing', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'completed', taskRef: {} as any }))

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'download')
    entry?.onClick?.()

    expect(downloadFileMock).not.toHaveBeenCalled()
  })

  it('exports workflow with default filename when prompting disabled', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        id: '7',
        state: 'completed',
        taskRef: { workflow: { foo: 'bar' } }
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'export-workflow')
    await entry?.onClick?.()

    expect(dialogServiceMock.prompt).not.toHaveBeenCalled()
    expect(downloadBlobMock).toHaveBeenCalledTimes(1)
    const [filename, blob] = downloadBlobMock.mock.calls[0]
    expect(filename).toBe('Job 7.json')
    await expect(blob.text()).resolves.toBe(
      JSON.stringify({ foo: 'bar' }, null, 2)
    )
  })

  it('prompts for filename when setting enabled', async () => {
    settingStoreMock.get.mockReturnValue(true)
    dialogServiceMock.prompt.mockResolvedValue('custom-name')
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        state: 'completed',
        taskRef: { workflow: {} }
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'export-workflow')
    await entry?.onClick?.()

    expect(dialogServiceMock.prompt).toHaveBeenCalledWith({
      title: expect.stringContaining('workflowService.exportWorkflow'),
      message: expect.stringContaining('workflowService.enterFilename'),
      defaultValue: 'Job job-1.json'
    })
    const [filename] = downloadBlobMock.mock.calls[0]
    expect(filename).toBe('custom-name.json')
  })

  it('keeps existing json extension when exporting workflow', async () => {
    settingStoreMock.get.mockReturnValue(true)
    dialogServiceMock.prompt.mockResolvedValue('existing.json')
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        id: '42',
        state: 'completed',
        taskRef: { workflow: { foo: 'bar' } }
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'export-workflow')
    await entry?.onClick?.()

    expect(appendJsonExtMock).toHaveBeenCalledWith('existing.json')
    const [filename] = downloadBlobMock.mock.calls[0]
    expect(filename).toBe('existing.json')
  })

  it('abandons export when prompt cancelled', async () => {
    settingStoreMock.get.mockReturnValue(true)
    dialogServiceMock.prompt.mockResolvedValue('')
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        state: 'completed',
        taskRef: { workflow: {} }
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'export-workflow')
    await entry?.onClick?.()

    expect(downloadBlobMock).not.toHaveBeenCalled()
  })

  it('deletes preview asset when confirmed', async () => {
    mediaAssetActionsMock.confirmDelete.mockResolvedValue(true)
    const { jobMenuEntries } = mountJobMenu()
    const preview = { filename: 'foo', subfolder: 'bar', type: 'output' }
    const taskRef = { previewOutput: preview }
    setCurrentItem(createJobItem({ state: 'completed', taskRef }))

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'delete')
    await entry?.onClick?.()

    expect(mapTaskOutputToAssetItemMock).toHaveBeenCalledWith(taskRef, preview)
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('does not refresh queue when delete cancelled', async () => {
    mediaAssetActionsMock.confirmDelete.mockResolvedValue(false)
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        state: 'completed',
        taskRef: { previewOutput: {} }
      })
    )

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'delete')
    await entry?.onClick?.()

    expect(queueStoreMock.update).not.toHaveBeenCalled()
  })

  it('removes failed job via menu entry', async () => {
    const taskRef = { id: 'task-1' }
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'failed', taskRef }))

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'delete')
    await entry?.onClick?.()

    expect(queueStoreMock.delete).toHaveBeenCalledWith(taskRef)
  })

  it('ignores failed job delete when taskRef missing', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'failed' }))

    await nextTick()
    const entry = findActionEntry(jobMenuEntries.value, 'delete')
    await entry?.onClick?.()

    expect(queueStoreMock.delete).not.toHaveBeenCalled()
  })

  it('provides completed menu structure with delete option', async () => {
    const inspectSpy = vi.fn()
    const { jobMenuEntries } = mountJobMenu(inspectSpy)
    setCurrentItem(
      createJobItem({
        state: 'completed',
        taskRef: { previewOutput: {} }
      })
    )

    await nextTick()
    expect(jobMenuEntries.value.map((entry) => entry.key)).toEqual([
      'inspect-asset',
      'add-to-current',
      'download',
      'd1',
      'open-workflow',
      'export-workflow',
      'd2',
      'copy-id',
      'd3',
      'delete'
    ])
    const inspectEntry = findActionEntry(jobMenuEntries.value, 'inspect-asset')
    await inspectEntry?.onClick?.()
    expect(inspectSpy).toHaveBeenCalledWith(currentItem.value)
  })

  it('omits inspect handler when callback missing', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(
      createJobItem({
        state: 'completed',
        taskRef: { previewOutput: {} }
      })
    )

    await nextTick()
    const inspectEntry = findActionEntry(jobMenuEntries.value, 'inspect-asset')
    expect(inspectEntry?.onClick).toBeUndefined()
  })

  it('omits delete asset entry when no preview exists', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'completed', taskRef: {} }))

    await nextTick()
    expect(jobMenuEntries.value.some((entry) => entry.key === 'delete')).toBe(
      false
    )
  })

  it('returns failed menu entries with error actions', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'failed', taskRef: { status: {} } }))

    await nextTick()
    expect(jobMenuEntries.value.map((entry) => entry.key)).toEqual([
      'open-workflow',
      'd1',
      'copy-id',
      'copy-error',
      'report-error',
      'd2',
      'delete'
    ])
  })

  it('returns active job entries with cancel option', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'running' }))

    await nextTick()
    expect(jobMenuEntries.value.map((entry) => entry.key)).toEqual([
      'open-workflow',
      'd1',
      'copy-id',
      'd2',
      'cancel-job'
    ])
  })

  it('provides pending job entries and triggers cancel action', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(createJobItem({ state: 'pending' }))

    await nextTick()
    expect(jobMenuEntries.value.map((entry) => entry.key)).toEqual([
      'open-workflow',
      'd1',
      'copy-id',
      'd2',
      'cancel-job'
    ])
    const cancelEntry = findActionEntry(jobMenuEntries.value, 'cancel-job')
    await cancelEntry?.onClick?.()

    expect(deleteItemMock).toHaveBeenCalledWith('queue', 'job-1')
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('returns empty menu when no job selected', async () => {
    const { jobMenuEntries } = mountJobMenu()
    setCurrentItem(null)

    await nextTick()
    expect(jobMenuEntries.value).toEqual([])
  })
})
