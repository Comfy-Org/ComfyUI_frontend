import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { JobListItem } from '@/composables/queue/useJobList'
import type { MenuEntry } from '@/types/menuTypes'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

const downloadFileMock = vi.fn()
vi.mock('@/base/common/downloadUtil', () => ({
  downloadFile: (url: string, filename?: string) => {
    if (filename === undefined) {
      return downloadFileMock(url)
    }
    return downloadFileMock(url, filename)
  }
}))

const copyToClipboardMock = vi.fn()
vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copyToClipboard: (text: string) => copyToClipboardMock(text)
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
  mapTaskOutputToAssetItem: (taskItem: TaskItemImpl, output: ResultItemImpl) =>
    mapTaskOutputToAssetItemMock(taskItem, output)
}))

const mediaAssetActionsMock = {
  deleteAssets: vi.fn()
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
  useWorkflowStore: () => workflowStoreMock,
  ComfyWorkflow: class {}
}))

const interruptMock = vi.fn()
const deleteItemMock = vi.fn()
vi.mock('@/scripts/api', () => ({
  api: {
    interrupt: (runningJobId: string | null) => interruptMock(runningJobId),
    deleteItem: (type: string, id: string) => deleteItemMock(type, id)
  }
}))

const downloadBlobMock = vi.fn()
vi.mock('@/scripts/utils', () => ({
  downloadBlob: (filename: string, blob: Blob) =>
    downloadBlobMock(filename, blob)
}))

const dialogServiceMock = {
  showErrorDialog: vi.fn(),
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

const nodeDefStoreMock: {
  nodeDefsByName: Record<string, Partial<ComfyNodeDefImpl>>
} = {
  nodeDefsByName: {}
}
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => nodeDefStoreMock,
  ComfyNodeDefImpl: class {}
}))

const queueStoreMock = {
  update: vi.fn(),
  delete: vi.fn()
}
vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => queueStoreMock
}))

const executionStoreMock = {
  clearInitializationByJobId: vi.fn()
}
vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => executionStoreMock
}))

const getJobWorkflowMock = vi.fn()
vi.mock('@/services/jobOutputCache', () => ({
  getJobWorkflow: (jobId: string) => getJobWorkflowMock(jobId)
}))

const createAnnotatedPathMock = vi.fn()
vi.mock('@/utils/createAnnotatedPath', () => ({
  createAnnotatedPath: (filename: string, subfolder: string, type: string) =>
    createAnnotatedPathMock(filename, subfolder, type)
}))

const appendJsonExtMock = vi.fn((value: string) =>
  value.toLowerCase().endsWith('.json') ? value : `${value}.json`
)
vi.mock('@/utils/formatUtil', () => ({
  appendJsonExt: (...args: Parameters<typeof appendJsonExtMock>) =>
    appendJsonExtMock(...args)
}))

import { useJobMenu } from '@/composables/queue/useJobMenu'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'

type MockTaskRef = Record<string, unknown>

type TestJobListItem = Omit<JobListItem, 'taskRef'> & {
  taskRef?: MockTaskRef
}

const createJobItem = (
  overrides: Partial<TestJobListItem> = {}
): JobListItem => ({
  id: overrides.id ?? 'job-1',
  title: overrides.title ?? 'Test job',
  meta: overrides.meta ?? 'meta',
  state: overrides.state ?? 'completed',
  taskRef: overrides.taskRef as TaskItemImpl | undefined,
  iconName: overrides.iconName,
  iconImageUrl: overrides.iconImageUrl,
  showClear: overrides.showClear,
  progressCurrentPercent: overrides.progressCurrentPercent,
  progressTotalPercent: overrides.progressTotalPercent,
  runningNodeName: overrides.runningNodeName,
  executionTimeMs: overrides.executionTimeMs,
  computeHours: overrides.computeHours
})

const mountJobMenu = (onInspectAsset?: (item: JobListItem) => void) =>
  useJobMenu(onInspectAsset)

const getMenuEntries = (
  item: JobListItem | null,
  onInspectAsset?: (item: JobListItem) => void
) => mountJobMenu(onInspectAsset).getJobMenuEntries(item)

const findActionEntry = (entries: MenuEntry[], key: string) =>
  entries.find(
    (entry): entry is Extract<MenuEntry, { kind?: 'item' }> =>
      entry.key === key && entry.kind !== 'divider'
  )

describe('useJobMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    mediaAssetActionsMock.deleteAssets.mockResolvedValue(false)
    mapTaskOutputToAssetItemMock.mockImplementation((task, output) => ({
      task,
      output
    }))
    createAnnotatedPathMock.mockReturnValue('annotated-path')
    nodeDefStoreMock.nodeDefsByName = {
      LoadImage: { name: 'LoadImage' },
      LoadVideo: { name: 'LoadVideo' },
      LoadAudio: { name: 'LoadAudio' }
    }
    // Default: no workflow available via lazy loading
    getJobWorkflowMock.mockResolvedValue(undefined)
  })

  it('opens workflow when workflow data exists', async () => {
    const { openJobWorkflow } = mountJobMenu()
    const workflow = { nodes: [] }
    // Mock lazy loading via fetchJobDetail + extractWorkflow
    getJobWorkflowMock.mockResolvedValue(workflow)
    const item = createJobItem({ id: '55' })

    await openJobWorkflow(item)

    expect(getJobWorkflowMock).toHaveBeenCalledWith('55')
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
    const item = createJobItem({ taskRef: {} })

    await openJobWorkflow(item)

    expect(workflowStoreMock.createTemporary).not.toHaveBeenCalled()
    expect(workflowServiceMock.openWorkflow).not.toHaveBeenCalled()
  })

  it('copies job id to clipboard', async () => {
    const { copyJobId } = mountJobMenu()
    const item = createJobItem({ id: 'job-99' })

    await copyJobId(item)

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
    const item = createJobItem({ state: state as JobListItem['state'] })

    await cancelJob(item)

    expect(interruptMock).toHaveBeenCalledWith('job-1')
    expect(deleteItemMock).not.toHaveBeenCalled()
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('cancels pending job via deleteItem', async () => {
    const { cancelJob } = mountJobMenu()
    const item = createJobItem({ state: 'pending' })

    await cancelJob(item)

    expect(deleteItemMock).toHaveBeenCalledWith('queue', 'job-1')
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('still updates queue for uncancellable states', async () => {
    const { cancelJob } = mountJobMenu()
    const item = createJobItem({ state: 'completed' })

    await cancelJob(item)

    expect(interruptMock).not.toHaveBeenCalled()
    expect(deleteItemMock).not.toHaveBeenCalled()
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('copies error message from failed job entry', async () => {
    const entries = getMenuEntries(
      createJobItem({
        state: 'failed',
        taskRef: {
          errorMessage: 'Something went wrong'
        } as Partial<TaskItemImpl>
      })
    )

    const entry = findActionEntry(entries, 'copy-error')
    await entry?.onClick?.()

    expect(copyToClipboardMock).toHaveBeenCalledWith('Something went wrong')
  })

  it('reports error via rich dialog when execution_error available', async () => {
    const executionError = {
      prompt_id: 'job-1',
      timestamp: 12345,
      node_id: '5',
      node_type: 'KSampler',
      executed: ['1', '2'],
      exception_message: 'CUDA out of memory',
      exception_type: 'RuntimeError',
      traceback: ['line 1', 'line 2'],
      current_inputs: {},
      current_outputs: {}
    }
    const entries = getMenuEntries(
      createJobItem({
        state: 'failed',
        taskRef: {
          errorMessage: 'CUDA out of memory',
          executionError,
          createTime: 12345
        } as Partial<TaskItemImpl>
      })
    )

    const entry = findActionEntry(entries, 'report-error')
    await entry?.onClick?.()

    expect(dialogServiceMock.showExecutionErrorDialog).toHaveBeenCalledTimes(1)
    expect(dialogServiceMock.showExecutionErrorDialog).toHaveBeenCalledWith(
      executionError
    )
    expect(dialogServiceMock.showErrorDialog).not.toHaveBeenCalled()
  })

  it('falls back to simple error dialog when no execution_error', async () => {
    const entries = getMenuEntries(
      createJobItem({
        state: 'failed',
        taskRef: {
          errorMessage: 'Job failed with error'
        } as Partial<TaskItemImpl>
      })
    )

    const entry = findActionEntry(entries, 'report-error')
    await entry?.onClick?.()

    expect(dialogServiceMock.showExecutionErrorDialog).not.toHaveBeenCalled()
    expect(dialogServiceMock.showErrorDialog).toHaveBeenCalledTimes(1)
    const [errorArg, optionsArg] =
      dialogServiceMock.showErrorDialog.mock.calls[0]
    expect(errorArg).toBeInstanceOf(Error)
    expect(errorArg.message).toBe('Job failed with error')
    expect(optionsArg).toEqual({ reportType: 'queueJobError' })
  })

  it('ignores error actions when message missing', async () => {
    const entries = getMenuEntries(
      createJobItem({
        state: 'failed',
        taskRef: { errorMessage: undefined } as Partial<TaskItemImpl>
      })
    )

    const copyEntry = findActionEntry(entries, 'copy-error')
    await copyEntry?.onClick?.()
    const reportEntry = findActionEntry(entries, 'report-error')
    await reportEntry?.onClick?.()

    expect(copyToClipboardMock).not.toHaveBeenCalled()
    expect(dialogServiceMock.showErrorDialog).not.toHaveBeenCalled()
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
      const preview = {
        filename: 'foo.png',
        subfolder: 'bar',
        type: 'output',
        url: 'http://asset',
        ...flags
      }
      const entries = getMenuEntries(
        createJobItem({
          state: 'completed',
          taskRef: { previewOutput: preview }
        })
      )

      const entry = findActionEntry(entries, 'add-to-current')
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
    const entries = getMenuEntries(
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

    const entry = findActionEntry(entries, 'add-to-current')
    await entry?.onClick?.()

    expect(litegraphServiceMock.addNodeOnGraph).not.toHaveBeenCalled()
  })

  it('skips adding node when preview output lacks media flags', async () => {
    const entries = getMenuEntries(
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

    const entry = findActionEntry(entries, 'add-to-current')
    await entry?.onClick?.()

    expect(litegraphServiceMock.addNodeOnGraph).not.toHaveBeenCalled()
    expect(createAnnotatedPathMock).not.toHaveBeenCalled()
  })

  it('skips annotating when litegraph node creation fails', async () => {
    litegraphServiceMock.addNodeOnGraph.mockReturnValueOnce(null)
    const entries = getMenuEntries(
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

    const entry = findActionEntry(entries, 'add-to-current')
    await entry?.onClick?.()

    expect(litegraphServiceMock.addNodeOnGraph).toHaveBeenCalled()
    expect(createAnnotatedPathMock).not.toHaveBeenCalled()
  })

  it('ignores add-to-current entry when preview missing entirely', async () => {
    const entries = getMenuEntries(
      createJobItem({
        state: 'completed',
        taskRef: {} as Partial<TaskItemImpl>
      })
    )

    const entry = findActionEntry(entries, 'add-to-current')
    await entry?.onClick?.()

    expect(litegraphServiceMock.addNodeOnGraph).not.toHaveBeenCalled()
  })

  it('downloads preview asset when requested', async () => {
    const entries = getMenuEntries(
      createJobItem({
        state: 'completed',
        taskRef: {
          previewOutput: { url: 'https://asset', isImage: true }
        }
      })
    )

    const entry = findActionEntry(entries, 'download')
    void entry?.onClick?.()

    expect(downloadFileMock).toHaveBeenCalledWith('https://asset')
  })

  it('ignores download request when preview missing', async () => {
    const entries = getMenuEntries(
      createJobItem({
        state: 'completed',
        taskRef: {} as Partial<TaskItemImpl>
      })
    )

    const entry = findActionEntry(entries, 'download')
    void entry?.onClick?.()

    expect(downloadFileMock).not.toHaveBeenCalled()
  })

  it('exports workflow with default filename when prompting disabled', async () => {
    const workflow = { foo: 'bar' }
    getJobWorkflowMock.mockResolvedValue(workflow)
    const entries = getMenuEntries(
      createJobItem({
        id: '7',
        state: 'completed'
      })
    )

    const entry = findActionEntry(entries, 'export-workflow')
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
    getJobWorkflowMock.mockResolvedValue({})
    const entries = getMenuEntries(
      createJobItem({
        state: 'completed'
      })
    )

    const entry = findActionEntry(entries, 'export-workflow')
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
    getJobWorkflowMock.mockResolvedValue({ foo: 'bar' })
    const entries = getMenuEntries(
      createJobItem({
        id: '42',
        state: 'completed'
      })
    )

    const entry = findActionEntry(entries, 'export-workflow')
    await entry?.onClick?.()

    expect(appendJsonExtMock).toHaveBeenCalledWith('existing.json')
    const [filename] = downloadBlobMock.mock.calls[0]
    expect(filename).toBe('existing.json')
  })

  it('abandons export when prompt cancelled', async () => {
    settingStoreMock.get.mockReturnValue(true)
    dialogServiceMock.prompt.mockResolvedValue('')
    getJobWorkflowMock.mockResolvedValue({})
    const entries = getMenuEntries(
      createJobItem({
        state: 'completed'
      })
    )

    const entry = findActionEntry(entries, 'export-workflow')
    await entry?.onClick?.()

    expect(downloadBlobMock).not.toHaveBeenCalled()
  })

  it('deletes preview asset when confirmed', async () => {
    mediaAssetActionsMock.deleteAssets.mockResolvedValue(true)
    const preview = { filename: 'foo', subfolder: 'bar', type: 'output' }
    const taskRef = { previewOutput: preview }
    const entries = getMenuEntries(
      createJobItem({ state: 'completed', taskRef })
    )

    const entry = findActionEntry(entries, 'delete')
    await entry?.onClick?.()

    expect(mapTaskOutputToAssetItemMock).toHaveBeenCalledWith(taskRef, preview)
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('does not refresh queue when delete cancelled', async () => {
    mediaAssetActionsMock.deleteAssets.mockResolvedValue(false)
    const entries = getMenuEntries(
      createJobItem({
        state: 'completed',
        taskRef: { previewOutput: {} }
      })
    )

    const entry = findActionEntry(entries, 'delete')
    await entry?.onClick?.()

    expect(queueStoreMock.update).not.toHaveBeenCalled()
  })

  it('removes failed job via menu entry', async () => {
    const taskRef = { id: 'task-1' }
    const entries = getMenuEntries(createJobItem({ state: 'failed', taskRef }))

    const entry = findActionEntry(entries, 'delete')
    await entry?.onClick?.()

    expect(queueStoreMock.delete).toHaveBeenCalledWith(taskRef)
  })

  it('ignores failed job delete when taskRef missing', async () => {
    const entries = getMenuEntries(createJobItem({ state: 'failed' }))

    const entry = findActionEntry(entries, 'delete')
    await entry?.onClick?.()

    expect(queueStoreMock.delete).not.toHaveBeenCalled()
  })

  it('provides completed menu structure with delete option', async () => {
    const inspectSpy = vi.fn()
    const item = createJobItem({
      state: 'completed',
      taskRef: { previewOutput: {} }
    })
    const entries = getMenuEntries(item, inspectSpy)

    expect(entries.map((entry) => entry.key)).toEqual([
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

    expect(findActionEntry(entries, 'inspect-asset')?.disabled).toBe(false)
    expect(findActionEntry(entries, 'add-to-current')?.disabled).toBe(false)
    expect(findActionEntry(entries, 'download')?.disabled).toBe(false)

    const inspectEntry = findActionEntry(entries, 'inspect-asset')
    await inspectEntry?.onClick?.()
    expect(inspectSpy).toHaveBeenCalledWith(item)
  })

  it('omits inspect handler when callback missing', async () => {
    const entries = getMenuEntries(
      createJobItem({
        state: 'completed',
        taskRef: { previewOutput: {} }
      })
    )

    const inspectEntry = findActionEntry(entries, 'inspect-asset')
    expect(inspectEntry?.onClick).toBeUndefined()
    expect(inspectEntry?.disabled).toBe(true)
  })

  it('omits delete asset entry when no preview exists', async () => {
    const entries = getMenuEntries(
      createJobItem({ state: 'completed', taskRef: {} })
    )

    expect(findActionEntry(entries, 'inspect-asset')?.disabled).toBe(true)
    expect(findActionEntry(entries, 'add-to-current')?.disabled).toBe(true)
    expect(findActionEntry(entries, 'download')?.disabled).toBe(true)
    expect(entries.some((entry) => entry.key === 'delete')).toBe(false)
  })

  it('returns failed menu entries with error actions', async () => {
    const entries = getMenuEntries(
      createJobItem({
        state: 'failed',
        taskRef: { errorMessage: 'Some error' } as Partial<TaskItemImpl>
      })
    )

    expect(entries.map((entry) => entry.key)).toEqual([
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
    const entries = getMenuEntries(createJobItem({ state: 'running' }))

    expect(entries.map((entry) => entry.key)).toEqual([
      'open-workflow',
      'd1',
      'copy-id',
      'd2',
      'cancel-job'
    ])
  })

  it('provides pending job entries and triggers cancel action', async () => {
    const entries = getMenuEntries(createJobItem({ state: 'pending' }))

    expect(entries.map((entry) => entry.key)).toEqual([
      'open-workflow',
      'd1',
      'copy-id',
      'd2',
      'cancel-job'
    ])
    const cancelEntry = findActionEntry(entries, 'cancel-job')
    await cancelEntry?.onClick?.()

    expect(deleteItemMock).toHaveBeenCalledWith('queue', 'job-1')
    expect(queueStoreMock.update).toHaveBeenCalled()
  })

  it('returns empty menu when no job selected', async () => {
    expect(getMenuEntries(null)).toEqual([])
  })
})
