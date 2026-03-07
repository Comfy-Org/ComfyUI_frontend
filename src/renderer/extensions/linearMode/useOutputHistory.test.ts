import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useAppModeStore } from '@/stores/appModeStore'
import { ResultItemImpl } from '@/stores/queueStore'

const mediaRef = ref<AssetItem[]>([])
const pendingResolveRef = ref(new Set<string>())
const inProgressItemsRef = ref<InProgressItem[]>([])
const activeWorkflowInProgressItemsRef = ref<InProgressItem[]>([])
const selectedIdRef = ref<string | null>(null)
const activeWorkflowPathRef = ref<string>('workflows/test.json')
const jobIdToPathRef = ref(new Map<string, string>())
const isActiveWorkflowRunningRef = ref(false)
const runningTasksRef = ref<Array<{ jobId: string }>>([])
const pendingTasksRef = ref<Array<{ jobId: string }>>([])

const selectAsLatestFn = vi.fn()
const resolveIfReadyFn = vi.fn()
const resolvedOutputsCacheRef = new Map<string, ResultItemImpl[]>()

vi.mock('@/platform/assets/composables/media/useMediaAssets', () => ({
  useMediaAssets: () => ({
    media: mediaRef,
    loading: ref(false),
    error: ref(null),
    fetchMediaList: vi.fn().mockResolvedValue([]),
    refresh: vi.fn().mockResolvedValue([]),
    loadMore: vi.fn(),
    hasMore: ref(false),
    isLoadingMore: ref(false)
  })
}))

vi.mock('@/renderer/extensions/linearMode/linearOutputStore', () => ({
  useLinearOutputStore: () => ({
    get pendingResolve() {
      return pendingResolveRef.value
    },
    get inProgressItems() {
      return inProgressItemsRef.value
    },
    get activeWorkflowInProgressItems() {
      return activeWorkflowInProgressItemsRef.value
    },
    get selectedId() {
      return selectedIdRef.value
    },
    resolvedOutputsCache: resolvedOutputsCacheRef,
    selectAsLatest: selectAsLatestFn,
    resolveIfReady: resolveIfReadyFn
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return { path: activeWorkflowPathRef.value }
    }
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    get jobIdToSessionWorkflowPath() {
      return jobIdToPathRef.value
    },
    get isActiveWorkflowRunning() {
      return isActiveWorkflowRunningRef.value
    }
  })
}))

vi.mock('@/stores/queueStore', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useQueueStore: () => ({
      get runningTasks() {
        return runningTasksRef.value
      },
      get pendingTasks() {
        return pendingTasksRef.value
      }
    })
  }
})

const { jobDetailResults } = vi.hoisted(() => ({
  jobDetailResults: new Map<string, unknown>()
}))

vi.mock('@/services/jobOutputCache', () => ({
  getJobDetail: (jobId: string) =>
    Promise.resolve(jobDetailResults.get(jobId) ?? undefined)
}))

vi.mock('@/renderer/extensions/linearMode/flattenNodeOutput', () => ({
  flattenNodeOutput: ([nodeId, output]: [
    string | number,
    Record<string, unknown>
  ]) => {
    if (!output.images) return []
    return (output.images as Array<Record<string, string>>).map(
      (img) =>
        new ResultItemImpl({
          ...img,
          nodeId: String(nodeId),
          mediaType: 'images'
        })
    )
  }
}))

function makeAsset(
  id: string,
  jobId: string,
  opts?: { allOutputs?: ResultItemImpl[]; outputCount?: number }
): AssetItem {
  return {
    id,
    name: `${id}.png`,
    tags: [],
    user_metadata: {
      jobId,
      nodeId: '1',
      subfolder: '',
      ...(opts?.allOutputs ? { allOutputs: opts.allOutputs } : {}),
      ...(opts?.outputCount !== undefined
        ? { outputCount: opts.outputCount }
        : {})
    }
  }
}

function makeResult(filename: string, nodeId: string = '1'): ResultItemImpl {
  return new ResultItemImpl({
    filename,
    subfolder: '',
    type: 'output',
    nodeId,
    mediaType: 'images'
  })
}

describe(useOutputHistory, () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mediaRef.value = []
    pendingResolveRef.value = new Set()
    inProgressItemsRef.value = []
    activeWorkflowInProgressItemsRef.value = []
    selectedIdRef.value = null
    activeWorkflowPathRef.value = 'workflows/test.json'
    jobIdToPathRef.value = new Map()
    isActiveWorkflowRunningRef.value = false
    runningTasksRef.value = []
    pendingTasksRef.value = []
    resolvedOutputsCacheRef.clear()
    jobDetailResults.clear()
    selectAsLatestFn.mockReset()
    resolveIfReadyFn.mockReset()
  })

  describe('sessionMedia filtering', () => {
    it('filters assets to match active workflow path', () => {
      jobIdToPathRef.value = new Map([
        ['job-1', 'workflows/test.json'],
        ['job-2', 'workflows/other.json']
      ])
      mediaRef.value = [makeAsset('a1', 'job-1'), makeAsset('a2', 'job-2')]

      const { outputs } = useOutputHistory()

      expect(outputs.media.value).toHaveLength(1)
      expect(outputs.media.value[0].id).toBe('a1')
    })

    it('returns empty when no workflow is active', () => {
      activeWorkflowPathRef.value = ''
      jobIdToPathRef.value = new Map([['job-1', 'workflows/test.json']])
      mediaRef.value = [makeAsset('a1', 'job-1')]

      const { outputs } = useOutputHistory()

      expect(outputs.media.value).toHaveLength(0)
    })

    it('updates when active workflow changes', async () => {
      jobIdToPathRef.value = new Map([
        ['job-1', 'workflows/a.json'],
        ['job-2', 'workflows/b.json']
      ])
      mediaRef.value = [makeAsset('a1', 'job-1'), makeAsset('a2', 'job-2')]

      activeWorkflowPathRef.value = 'workflows/a.json'
      const { outputs } = useOutputHistory()

      expect(outputs.media.value).toHaveLength(1)
      expect(outputs.media.value[0].id).toBe('a1')

      activeWorkflowPathRef.value = 'workflows/b.json'
      await nextTick()

      expect(outputs.media.value).toHaveLength(1)
      expect(outputs.media.value[0].id).toBe('a2')
    })
  })

  describe('allOutputs', () => {
    it('returns empty for undefined item', () => {
      const { allOutputs } = useOutputHistory()

      expect(allOutputs()).toEqual([])
      expect(allOutputs(undefined)).toEqual([])
    })

    it('returns outputs from metadata allOutputs when count matches', () => {
      const results = [makeResult('a.png'), makeResult('b.png')]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 2
      })

      const { allOutputs } = useOutputHistory()
      const outputs = allOutputs(asset)

      expect(outputs).toHaveLength(2)
      // Should be reversed
      expect(outputs[0].filename).toBe('b.png')
      expect(outputs[1].filename).toBe('a.png')
    })

    it('filters outputs to selected output nodes only', () => {
      const results = [
        makeResult('a.png', '1'),
        makeResult('b.png', '2'),
        makeResult('c.png', '3')
      ]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 3
      })

      const appModeStore = useAppModeStore()
      appModeStore.selectedOutputs.push('2')

      const { allOutputs } = useOutputHistory()
      const outputs = allOutputs(asset)

      expect(outputs).toHaveLength(1)
      expect(outputs[0].filename).toBe('b.png')
    })

    it('returns all outputs when no output nodes are selected', () => {
      const results = [makeResult('a.png', '1'), makeResult('b.png', '2')]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 2
      })

      const { allOutputs } = useOutputHistory()
      const outputs = allOutputs(asset)

      expect(outputs).toHaveLength(2)
    })

    it('returns consistent filtered outputs across repeated calls', () => {
      const results = [makeResult('a.png', '1'), makeResult('b.png', '2')]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 2
      })

      const appModeStore = useAppModeStore()
      appModeStore.selectedOutputs.push('2')

      const { allOutputs } = useOutputHistory()
      const first = allOutputs(asset)
      const second = allOutputs(asset)

      expect(first).toEqual(second)
      expect(first).toHaveLength(1)
      expect(first[0].filename).toBe('b.png')
    })

    it('returns in-progress outputs for pending resolve jobs', () => {
      pendingResolveRef.value = new Set(['job-1'])
      inProgressItemsRef.value = [
        {
          id: 'item-1',
          jobId: 'job-1',
          state: 'image',
          output: makeResult('a.png')
        },
        {
          id: 'item-2',
          jobId: 'job-1',
          state: 'image',
          output: makeResult('b.png')
        }
      ]
      const asset = makeAsset('a1', 'job-1')

      const { allOutputs } = useOutputHistory()
      const outputs = allOutputs(asset)

      expect(outputs).toHaveLength(2)
      expect(outputs[0].filename).toBe('a.png')
      expect(outputs[1].filename).toBe('b.png')
    })

    it('fetches full job detail for multi-output jobs', async () => {
      jobDetailResults.set('job-1', {
        outputs: {
          '1': {
            images: [
              { filename: 'a.png', subfolder: '', type: 'output' },
              { filename: 'b.png', subfolder: '', type: 'output' },
              { filename: 'c.png', subfolder: '', type: 'output' }
            ]
          }
        }
      })
      const asset = makeAsset('a1', 'job-1')

      const { allOutputs } = useOutputHistory()

      expect(allOutputs(asset)).toEqual([])

      await nextTick()
      await nextTick()

      const resolved = allOutputs(asset)
      expect(resolved).toHaveLength(3)
      expect(resolved[0].filename).toBe('c.png')
    })
  })

  describe('watchEffect resolve loop', () => {
    it('resolves pending jobs when history outputs load', async () => {
      const results = [makeResult('a.png')]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 1
      })
      jobIdToPathRef.value = new Map([['job-1', 'workflows/test.json']])
      pendingResolveRef.value = new Set(['job-1'])
      mediaRef.value = [asset]
      selectedIdRef.value = null

      useOutputHistory()
      await nextTick()

      expect(resolveIfReadyFn).toHaveBeenCalledWith('job-1', true)
      expect(selectAsLatestFn).toHaveBeenCalledWith('history:a1:0')
    })

    it('does not select first history when a selection exists', async () => {
      const results = [makeResult('a.png')]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 1
      })
      jobIdToPathRef.value = new Map([['job-1', 'workflows/test.json']])
      pendingResolveRef.value = new Set(['job-1'])
      mediaRef.value = [asset]
      selectedIdRef.value = 'history:existing:0'

      useOutputHistory()
      await nextTick()

      expect(resolveIfReadyFn).toHaveBeenCalledWith('job-1', true)
      expect(selectAsLatestFn).not.toHaveBeenCalled()
    })

    it('skips jobs with no matching asset in media', async () => {
      pendingResolveRef.value = new Set(['job-missing'])
      mediaRef.value = []

      useOutputHistory()
      await nextTick()

      expect(resolveIfReadyFn).not.toHaveBeenCalled()
    })
  })

  describe('selectFirstHistory', () => {
    it('selects first media item', () => {
      jobIdToPathRef.value = new Map([['job-1', 'workflows/test.json']])
      mediaRef.value = [makeAsset('a1', 'job-1')]

      const { selectFirstHistory } = useOutputHistory()
      selectFirstHistory()

      expect(selectAsLatestFn).toHaveBeenCalledWith('history:a1:0')
    })

    it('selects null when no media', () => {
      const { selectFirstHistory } = useOutputHistory()
      selectFirstHistory()

      expect(selectAsLatestFn).toHaveBeenCalledWith(null)
    })
  })

  describe('mayBeActiveWorkflowPending', () => {
    it('returns false when no tasks are queued', () => {
      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(false)
    })

    it('returns false when there are active in-progress items', () => {
      activeWorkflowInProgressItemsRef.value = [
        { id: 'item-1', jobId: 'job-1', state: 'skeleton' }
      ]
      runningTasksRef.value = [{ jobId: 'job-1' }]
      jobIdToPathRef.value = new Map([['job-1', 'workflows/test.json']])

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(false)
    })

    it('returns true when a running task matches the active workflow', () => {
      runningTasksRef.value = [{ jobId: 'job-1' }]
      jobIdToPathRef.value = new Map([['job-1', 'workflows/test.json']])

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(true)
    })

    it('returns true when a pending task matches the active workflow', () => {
      pendingTasksRef.value = [{ jobId: 'job-1' }]
      jobIdToPathRef.value = new Map([['job-1', 'workflows/test.json']])

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(true)
    })

    it('returns false when tasks belong to another workflow', () => {
      runningTasksRef.value = [{ jobId: 'job-1' }]
      jobIdToPathRef.value = new Map([['job-1', 'workflows/other.json']])

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(false)
    })

    it('returns false when no workflow path is set', () => {
      activeWorkflowPathRef.value = ''
      runningTasksRef.value = [{ jobId: 'job-1' }]

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(false)
    })
  })
})
