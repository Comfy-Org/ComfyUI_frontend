import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useQueueStore } from '@/stores/queueStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { fromPartial } from '@total-typescript/shoehorn'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, toValue } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useAppModeStore } from '@/stores/appModeStore'
import type { AugmentedResultItem } from '@/utils/resultItem'
import { toNodeId } from '@/types/nodeId'

vi.mock(import('@/platform/assets/composables/media/assetMappers'), () => ({
  getAssetType: (tags?: string[]) =>
    tags?.[0] === 'output' ? 'output' : 'input',
  mapInputFileToAssetItem: vi.fn(),
  mapTaskOutputToAssetItem: vi.fn(),
  unflattenOutputAssets: vi.fn()
}))

const { jobDetailResults } = vi.hoisted(() => ({
  jobDetailResults: new Map<string, unknown>()
}))

vi.mock<unknown>(import('@/services/jobOutputCache'), () => ({
  getJobDetail: (jobId: string) =>
    Promise.resolve(jobDetailResults.get(jobId) ?? undefined)
}))

function makeAsset(
  id: string,
  jobId: string,
  opts?: { allOutputs?: AugmentedResultItem[]; outputCount?: number }
): AssetItem {
  return fromPartial({
    id,
    name: `${id}.png`,
    tags: [],
    preview_url: `/view?filename=${id}.png`,
    user_metadata: {
      jobId,
      nodeId: toNodeId('1'),
      subfolder: '',
      ...(opts?.allOutputs ? { allOutputs: opts.allOutputs } : {}),
      ...(opts?.outputCount !== undefined
        ? { outputCount: opts.outputCount }
        : {})
    }
  })
}

function makeResult(
  filename: string,
  nodeId: string = '1'
): AugmentedResultItem {
  return {
    filename,
    subfolder: '',
    type: 'output',
    nodeId,
    mediaType: 'images'
  }
}

beforeEach(() => {
  useAssetsStore().outputAssets.hasMore = false
  vi.spyOn(useAssetsStore().outputAssets, 'loadMore').mockResolvedValue(
    undefined
  )
  vi.mocked(useLinearOutputStore().selectAsLatest).mockImplementation(
    () => undefined
  )
  vi.mocked(useLinearOutputStore().resolveIfReady).mockImplementation(
    () => undefined
  )
})

describe(useOutputHistory, () => {
  beforeEach(() => {
    useAssetsStore().outputAssets.items = []
    useLinearOutputStore().pendingResolve = new Set()
    useLinearOutputStore().inProgressItems = []
    Object.assign(useLinearOutputStore(), { activeWorkflowInProgressItems: [] })
    useLinearOutputStore().selectedId = null
    useWorkflowStore().activeWorkflow = fromPartial({
      path: 'workflows/test.json'
    })
    useExecutionStore().jobIdToSessionWorkflowPath = new Map()
    Object.assign(useExecutionStore(), { isActiveWorkflowRunning: false })
    useQueueStore().runningTasks = []
    useQueueStore().pendingTasks = []
    useLinearOutputStore().resolvedOutputsCache.clear()
    jobDetailResults.clear()
  })

  describe('sessionMedia filtering', () => {
    it('filters assets to match active workflow path', () => {
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/test.json'],
        ['job-2', 'workflows/other.json']
      ])
      useAssetsStore().outputAssets.items = [
        makeAsset('a1', 'job-1'),
        makeAsset('a2', 'job-2')
      ]

      const { outputs } = useOutputHistory()

      expect(toValue(outputs.items)).toHaveLength(1)
      expect(toValue(outputs.items)[0].id).toBe('a1')
    })

    it('returns empty when no workflow is active', () => {
      useWorkflowStore().activeWorkflow = fromPartial({ path: '' })
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/test.json']
      ])
      useAssetsStore().outputAssets.items = [makeAsset('a1', 'job-1')]

      const { outputs } = useOutputHistory()

      expect(toValue(outputs.items)).toHaveLength(0)
    })

    it('updates when active workflow changes', async () => {
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/a.json'],
        ['job-2', 'workflows/b.json']
      ])
      useAssetsStore().outputAssets.items = [
        makeAsset('a1', 'job-1'),
        makeAsset('a2', 'job-2')
      ]

      useWorkflowStore().activeWorkflow = fromPartial({
        path: 'workflows/a.json'
      })
      const { outputs } = useOutputHistory()

      expect(toValue(outputs.items)).toHaveLength(1)
      expect(toValue(outputs.items)[0].id).toBe('a1')

      useWorkflowStore().activeWorkflow = fromPartial({
        path: 'workflows/b.json'
      })
      await nextTick()

      expect(toValue(outputs.items)).toHaveLength(1)
      expect(toValue(outputs.items)[0].id).toBe('a2')
    })
  })

  describe('allOutputs', () => {
    it('returns empty for undefined item', () => {
      const { allOutputs } = useOutputHistory()

      expect(allOutputs()).toEqual([])
      expect(allOutputs(undefined)).toEqual([])
    })

    it('returns outputs from metadata allOutputs when count matches', () => {
      useAppModeStore().selectedOutputs.push(toNodeId('1'))
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
      appModeStore.selectedOutputs.push(toNodeId('2'))

      const { allOutputs } = useOutputHistory()
      const outputs = allOutputs(asset)

      expect(outputs).toHaveLength(1)
      expect(outputs[0].filename).toBe('b.png')
    })

    it('returns empty when no output nodes are selected', () => {
      const results = [makeResult('a.png', '1'), makeResult('b.png', '2')]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 2
      })

      const { allOutputs } = useOutputHistory()
      const outputs = allOutputs(asset)

      expect(outputs).toHaveLength(0)
    })

    it('returns consistent filtered outputs across repeated calls', () => {
      const results = [makeResult('a.png', '1'), makeResult('b.png', '2')]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 2
      })

      const appModeStore = useAppModeStore()
      appModeStore.selectedOutputs.push(toNodeId('2'))

      const { allOutputs } = useOutputHistory()
      const first = allOutputs(asset)
      const second = allOutputs(asset)

      expect(first).toEqual(second)
      expect(first).toHaveLength(1)
      expect(first[0].filename).toBe('b.png')
    })

    it('returns in-progress outputs for pending resolve jobs', () => {
      useAppModeStore().selectedOutputs.push(toNodeId('1'))
      useLinearOutputStore().pendingResolve = new Set(['job-1'])
      useLinearOutputStore().inProgressItems = [
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
      useAppModeStore().selectedOutputs.push(toNodeId('1'))
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
      useAppModeStore().selectedOutputs.push(toNodeId('1'))
      const results = [makeResult('a.png')]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 1
      })
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/test.json']
      ])
      useLinearOutputStore().pendingResolve = new Set(['job-1'])
      useAssetsStore().outputAssets.items = [asset]
      useLinearOutputStore().selectedId = null

      useOutputHistory()
      await nextTick()

      expect(
        vi.mocked(useLinearOutputStore().resolveIfReady)
      ).toHaveBeenCalledWith('job-1', true)
      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).toHaveBeenCalledWith('history:a1:0')
    })

    it('does not select first history when a selection exists', async () => {
      useAppModeStore().selectedOutputs.push(toNodeId('1'))
      const results = [makeResult('a.png')]
      const asset = makeAsset('a1', 'job-1', {
        allOutputs: results,
        outputCount: 1
      })
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/test.json']
      ])
      useLinearOutputStore().pendingResolve = new Set(['job-1'])
      useAssetsStore().outputAssets.items = [asset]
      useLinearOutputStore().selectedId = 'history:existing:0'

      useOutputHistory()
      await nextTick()

      expect(
        vi.mocked(useLinearOutputStore().resolveIfReady)
      ).toHaveBeenCalledWith('job-1', true)
      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).not.toHaveBeenCalled()
    })

    it('skips jobs with no matching asset in media', async () => {
      useLinearOutputStore().pendingResolve = new Set(['job-missing'])
      useAssetsStore().outputAssets.items = []

      useOutputHistory()
      await nextTick()

      expect(
        vi.mocked(useLinearOutputStore().resolveIfReady)
      ).not.toHaveBeenCalled()
    })
  })

  describe('selectFirstHistory', () => {
    it('selects first media item', () => {
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/test.json']
      ])
      useAssetsStore().outputAssets.items = [makeAsset('a1', 'job-1')]

      const { selectFirstHistory } = useOutputHistory()
      selectFirstHistory()

      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).toHaveBeenCalledWith('history:a1:0')
    })

    it('selects null when no media', () => {
      const { selectFirstHistory } = useOutputHistory()
      selectFirstHistory()

      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).toHaveBeenCalledWith(null)
    })
  })

  describe('mayBeActiveWorkflowPending', () => {
    it('returns false when no tasks are queued', () => {
      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(false)
    })

    it('returns false when there are active in-progress items', () => {
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [
          { id: 'item-1', jobId: 'job-1', state: 'skeleton' }
        ]
      })
      useQueueStore().runningTasks = fromPartial([{ jobId: 'job-1' }])
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/test.json']
      ])

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(false)
    })

    it('returns true when a running task matches the active workflow', () => {
      useQueueStore().runningTasks = fromPartial([{ jobId: 'job-1' }])
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/test.json']
      ])

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(true)
    })

    it('returns false when only pending tasks exist', () => {
      useQueueStore().pendingTasks = fromPartial([{ jobId: 'job-1' }])
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/test.json']
      ])

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(false)
    })

    it('returns false when tasks belong to another workflow', () => {
      useQueueStore().runningTasks = fromPartial([{ jobId: 'job-1' }])
      useExecutionStore().jobIdToSessionWorkflowPath = new Map([
        ['job-1', 'workflows/other.json']
      ])

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(false)
    })

    it('returns false when no workflow path is set', () => {
      useWorkflowStore().activeWorkflow = fromPartial({ path: '' })
      useQueueStore().runningTasks = fromPartial([{ jobId: 'job-1' }])

      const { mayBeActiveWorkflowPending } = useOutputHistory()
      expect(mayBeActiveWorkflowPending.value).toBe(false)
    })
  })
})
