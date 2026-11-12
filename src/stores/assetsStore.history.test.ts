import type { JobDetail, JobListItem } from '@comfyorg/api-client/jobTypes'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope, nextTick, toValue } from 'vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import { useOutputHistory } from '@/renderer/extensions/linearMode/useOutputHistory'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionStore } from '@/stores/executionStore'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/useFeatureFlags'))

describe('assetsStore - resolved history outputs', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async () => new Response('[]'))
  })

  function job(id: string): JobListItem {
    return {
      id,
      status: 'completed',
      create_time: 1700000000000,
      execution_start_time: 1700000000000,
      priority: 0,
      outputs_count: 2,
      previewable_outputs_count: 2,
      preview_output: {
        filename: `${id}-a.png`,
        mediaType: 'images',
        nodeId: '1',
        subfolder: '',
        type: 'output'
      }
    }
  }

  function detail(id: string): JobDetail {
    return {
      ...job(id),
      outputs: {
        '1': {
          images: [
            { filename: `${id}-a.png`, subfolder: '', type: 'output' },
            { filename: `${id}-b.png`, subfolder: '', type: 'output' }
          ]
        }
      }
    }
  }

  it('retains resolved children through a failed refresh and replaces them on recovery', async () => {
    vi.mocked(api.getHistory)
      .mockResolvedValueOnce([job('retained')])
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce([job('replacement')])
    vi.mocked(api.getJobDetail)
      .mockResolvedValueOnce(detail('retained'))
      .mockResolvedValueOnce(detail('replacement'))
    const store = useAssetsStore()
    await vi.waitFor(() =>
      expect(
        toValue(store.flatOutputAssets.items).map(({ name }) => name)
      ).toEqual(['retained-b.png', 'retained-a.png'])
    )

    await store.outputAssets.invalidate()

    expect(toValue(store.outputAssets.items).map(({ id }) => id)).toEqual([
      'retained'
    ])
    expect(
      toValue(store.flatOutputAssets.items).map(({ name }) => name)
    ).toEqual(['retained-b.png', 'retained-a.png'])
    expect(toValue(store.allAssets.items).map(({ name }) => name)).toEqual([
      'retained-b.png',
      'retained-a.png'
    ])

    await store.outputAssets.invalidate()

    await vi.waitFor(() =>
      expect(
        toValue(store.flatOutputAssets.items).map(({ name }) => name)
      ).toEqual(['replacement-b.png', 'replacement-a.png'])
    )
  })

  it('keeps children from independently completed jobs with their parent timestamps', async () => {
    let finishFirst!: (value: JobDetail) => void
    let finishSecond!: (value: JobDetail) => void
    const first = new Promise<JobDetail>((resolve) => {
      finishFirst = resolve
    })
    const second = new Promise<JobDetail>((resolve) => {
      finishSecond = resolve
    })
    vi.mocked(api.getHistory).mockResolvedValueOnce([
      { ...job('first'), execution_start_time: 1700003600000 },
      job('second')
    ])
    vi.mocked(api.getJobDetail)
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const store = useAssetsStore()
    await vi.waitFor(() => expect(api.getJobDetail).toHaveBeenCalledTimes(2))

    finishSecond(detail('second'))
    await vi.waitFor(() =>
      expect(
        toValue(store.flatOutputAssets.items).map(({ name }) => name)
      ).toEqual(['first-a.png', 'second-b.png', 'second-a.png'])
    )
    finishFirst(detail('first'))

    await vi.waitFor(() =>
      expect(
        toValue(store.flatOutputAssets.items).map(({ name }) => name)
      ).toEqual(['first-b.png', 'first-a.png', 'second-b.png', 'second-a.png'])
    )
    expect(
      toValue(store.flatOutputAssets.items).map(({ created_at }) => created_at)
    ).toEqual([
      '2023-11-14T23:13:20.000Z',
      '2023-11-14T23:13:20.000Z',
      '2023-11-14T22:13:20.000Z',
      '2023-11-14T22:13:20.000Z'
    ])
    expect(
      new Set(toValue(store.flatOutputAssets.items).map(({ id }) => id)).size
    ).toBe(4)
  })

  it('recovers inline text in App history when the asset API has no files', async () => {
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    vi.mocked(api.fetchApi).mockImplementation(
      async () =>
        new Response(JSON.stringify({ assets: [], total: 0, has_more: false }))
    )
    vi.mocked(api.getHistory).mockResolvedValueOnce([
      {
        ...job('text-job'),
        outputs_count: 1,
        previewable_outputs_count: 1,
        preview_output: {
          nodeId: '1',
          mediaType: 'text',
          content: 'Recovered inline text'
        }
      }
    ])
    useWorkflowStore().activeWorkflow = fromPartial({ path: 'text.json' })
    useExecutionStore().jobIdToSessionWorkflowPath.set('text-job', 'text.json')
    useAppModeStore().selectedOutputs = [toNodeId('1')]
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const history = scope.run(useOutputHistory)
    assert(history)

    await vi.waitFor(() =>
      expect(
        toValue(history.outputs.items).flatMap(history.allOutputs)
      ).toEqual([
        expect.objectContaining({
          nodeId: '1',
          mediaType: 'text',
          content: 'Recovered inline text'
        })
      ])
    )
  })

  it('does not start resolving abandoned history after switching to the asset API', async () => {
    let finishHistory!: (value: JobListItem[]) => void
    vi.mocked(api.getHistory).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishHistory = resolve
        })
    )
    vi.mocked(api.fetchApi).mockImplementation(
      async () =>
        new Response(JSON.stringify({ assets: [], total: 0, has_more: false }))
    )
    const store = useAssetsStore()
    const pendingHistory = store.outputAssets.loadMore()
    vi.mocked(useFeatureFlags().flags).assetsEnabled = true
    await nextTick()

    finishHistory([job('abandoned')])
    await pendingHistory
    await nextTick()

    expect(api.getJobDetail).not.toHaveBeenCalled()
    expect(toValue(store.flatOutputAssets.items)).toEqual([])
  })
})
