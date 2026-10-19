import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import type {
  ComfyWorkflow,
  LoadedComfyWorkflow
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

function makeJob(id: string, status: JobListItem['status']): JobListItem {
  return {
    id,
    status,
    create_time: 0,
    update_time: 0,
    last_state_update: 0,
    priority: 0
  }
}

vi.mock(import('@/scripts/api'))

describe('useReconnectQueueRefresh', () => {
  beforeEach(() => {
    vi.mocked(api.getQueue).mockResolvedValue({ Running: [], Pending: [] })
    vi.mocked(api.getHistory).mockResolvedValue([])
    vi.mocked(api.getJobDetail).mockResolvedValue(undefined)
  })

  it('forwards running+pending job ids to clearActiveJobIfStale', async () => {
    vi.mocked(api.getQueue).mockResolvedValue({
      Running: [makeJob('run-1', 'in_progress')],
      Pending: [makeJob('pend-1', 'pending'), makeJob('pend-2', 'pending')]
    })
    const executionStore = useExecutionStore()
    const clearSpy = vi
      .spyOn(executionStore, 'clearActiveJobIfStale')
      .mockImplementation(() => {})

    const refresh = useReconnectQueueRefresh()
    await refresh()

    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledWith(
      new Set(['run-1', 'pend-1', 'pend-2'])
    )
  })

  it('passes an empty set when the queue is genuinely empty', async () => {
    const executionStore = useExecutionStore()
    const clearSpy = vi
      .spyOn(executionStore, 'clearActiveJobIfStale')
      .mockImplementation(() => {})

    const refresh = useReconnectQueueRefresh()
    await refresh()

    expect(clearSpy).toHaveBeenCalledWith(new Set())
  })

  it('reuses the prior queue snapshot when the fetch fails, so a still-running job is not falsely cleared', async () => {
    vi.mocked(api.getQueue)
      .mockResolvedValueOnce({
        Running: [makeJob('run-1', 'in_progress')],
        Pending: []
      })
      .mockRejectedValueOnce(new Error('network down'))
    const executionStore = useExecutionStore()
    const clearSpy = vi
      .spyOn(executionStore, 'clearActiveJobIfStale')
      .mockImplementation(() => {})

    const refresh = useReconnectQueueRefresh()
    await refresh() // primes the store with run-1
    await refresh() // network failure here — store must not go empty

    expect(clearSpy).toHaveBeenLastCalledWith(new Set(['run-1']))
  })

  describe('outputs of a run that finished while the socket was down', () => {
    const image = {
      filename: 'out.png',
      subfolder: '',
      type: 'output' as const
    }
    const finishedJob = {
      ...makeJob('job-1', 'completed'),
      outputs: { '9': { images: [image] } }
    }

    function followRun(jobId: string, workflow?: ComfyWorkflow) {
      const executionStore = useExecutionStore()
      executionStore.activeJobId = jobId
      executionStore.queuedJobs[jobId] = { nodes: {}, workflow }
    }

    function replayedExecutedFrames() {
      return vi
        .mocked(api.dispatchCustomEvent)
        .mock.calls.filter(([type]) => type === 'executed')
    }

    it('replays the finished run outputs as executed frames', async () => {
      followRun('job-1')
      vi.mocked(api.getJobDetail).mockResolvedValue(finishedJob)

      await useReconnectQueueRefresh()()

      expect(api.getJobDetail).toHaveBeenCalledWith(
        'job-1',
        expect.any(AbortSignal)
      )
      expect(replayedExecutedFrames()).toEqual([
        [
          'executed',
          {
            node: '9',
            display_node: '9',
            output: { images: [image] },
            prompt_id: 'job-1'
          }
        ]
      ])
    })

    it('replays before the finished run is cleared, so listeners can still attribute it', async () => {
      followRun('job-1')
      vi.mocked(api.getJobDetail).mockResolvedValue(finishedJob)
      const executionStore = useExecutionStore()
      let activeWhenReplayed: string | null = null
      vi.mocked(api.dispatchCustomEvent).mockImplementation(() => {
        activeWhenReplayed = executionStore.activeJobId
        return true
      })

      await useReconnectQueueRefresh()()

      expect(activeWhenReplayed).toBe('job-1')
      expect(executionStore.activeJobId).toBeNull()
      expect(executionStore.queuedJobs).toEqual({})
    })

    it('falls back to the history preview when the job detail is unavailable', async () => {
      followRun('job-1')
      vi.mocked(api.getHistory).mockResolvedValue([
        {
          ...makeJob('job-1', 'completed'),
          outputs_count: 1,
          preview_output: { ...image, nodeId: '9', mediaType: 'images' }
        }
      ])

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([
        [
          'executed',
          expect.objectContaining({
            node: '9',
            output: { images: [expect.objectContaining(image)] }
          })
        ]
      ])
    })

    it('keeps following a queued run whose only history preview is text', async () => {
      useExecutionStore().queuedJobs['job-1'] = { nodes: {} }
      vi.mocked(api.getHistory).mockResolvedValue([
        {
          ...makeJob('job-1', 'completed'),
          outputs_count: 1,
          preview_output: {
            filename: '',
            subfolder: '',
            type: 'output',
            nodeId: '9',
            mediaType: 'text',
            content: 'hello'
          }
        }
      ])

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
      expect(Object.keys(useExecutionStore().queuedJobs)).toEqual(['job-1'])
    })

    it.for([3, null])(
      'does not replay a lone preview when the output count is %s',
      async (outputsCount) => {
        followRun('job-1')
        vi.mocked(api.getHistory).mockResolvedValue([
          {
            ...makeJob('job-1', 'completed'),
            outputs_count: outputsCount,
            preview_output: { ...image, nodeId: '9', mediaType: 'images' }
          }
        ])

        await useReconnectQueueRefresh()()

        expect(replayedExecutedFrames()).toEqual([])
      }
    )

    it('leaves a run that is still going to the live socket', async () => {
      followRun('job-1')
      vi.mocked(api.getQueue).mockResolvedValue({
        Running: [makeJob('job-1', 'in_progress')],
        Pending: []
      })

      await useReconnectQueueRefresh()()

      expect(api.getJobDetail).not.toHaveBeenCalled()
      expect(replayedExecutedFrames()).toEqual([])
      expect(useExecutionStore().activeJobId).toBe('job-1')
    })

    it('does not replay outputs of a run that failed, and stops following it', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-1'] = { nodes: {} }
      vi.mocked(api.getJobDetail).mockResolvedValue({
        ...finishedJob,
        status: 'failed'
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
      expect(executionStore.queuedJobs).toEqual({})
    })

    it('keeps following a submitted job the queue snapshot does not list yet', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-2'] = { nodes: {} }
      vi.mocked(api.getJobDetail).mockResolvedValue(makeJob('job-2', 'pending'))

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
      expect(Object.keys(executionStore.queuedJobs)).toEqual(['job-2'])
    })

    it('restores a queued run that finished alongside the active one, once', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-0'] = { nodes: {} }
      followRun('job-1')
      vi.mocked(api.getJobDetail).mockImplementation(async (jobId) => ({
        ...finishedJob,
        id: jobId
      }))
      const refresh = useReconnectQueueRefresh()

      await refresh()
      await refresh()

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ prompt_id: 'job-0' })],
        ['executed', expect.objectContaining({ prompt_id: 'job-1' })]
      ])
      expect(executionStore.queuedJobs).toEqual({})
    })

    it('does not touch a run that started while the outputs were being fetched', async () => {
      followRun('job-1')
      const executionStore = useExecutionStore()
      vi.mocked(api.getJobDetail).mockImplementation(async () => {
        executionStore.activeJobId = 'job-new'
        executionStore.queuedJobs['job-new'] = { nodes: {} }
        return finishedJob
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
      expect(executionStore.activeJobId).toBe('job-new')
      expect(Object.keys(executionStore.queuedJobs)).toContain('job-new')
    })

    it('ignores runs this tab was not following', async () => {
      vi.mocked(api.getHistory).mockResolvedValue([
        {
          ...makeJob('someone-else', 'completed'),
          outputs_count: 1,
          preview_output: { ...image, nodeId: '9', mediaType: 'images' }
        }
      ])

      await useReconnectQueueRefresh()()

      expect(api.getJobDetail).not.toHaveBeenCalled()
      expect(replayedExecutedFrames()).toEqual([])
    })

    it('replays a run recorded against the open workflow onto the open graph', async () => {
      const open = fromPartial<LoadedComfyWorkflow>({
        path: 'workflows/open.json',
        changeTracker: { nodeOutputs: undefined }
      })
      useWorkflowStore().activeWorkflow = open
      followRun('job-1', open)
      vi.mocked(api.getJobDetail).mockResolvedValue(finishedJob)

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([
        [
          'executed',
          expect.objectContaining({
            node: '9',
            output: { images: [image] },
            prompt_id: 'job-1'
          })
        ]
      ])
      expect(open.changeTracker.nodeOutputs).toBeUndefined()
    })

    it('keeps a background workflow run outputs with that workflow instead of the open graph', async () => {
      const background = fromPartial<ComfyWorkflow>({
        path: 'workflows/other.json',
        changeTracker: { nodeOutputs: undefined }
      })
      followRun('job-1', background)
      vi.mocked(api.getJobDetail).mockResolvedValue(finishedJob)

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
      expect(background.changeTracker?.nodeOutputs).toEqual({
        '9': { images: [image] }
      })
    })

    it('keeps a submitted job that becomes active during the refresh', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-2'] = { nodes: {} }
      vi.mocked(api.getJobDetail).mockImplementation(async () => {
        executionStore.activeJobId = 'job-2'
        return makeJob('job-2', 'in_progress')
      })

      await useReconnectQueueRefresh()()

      expect(executionStore.activeJobId).toBe('job-2')
      expect(Object.keys(executionStore.queuedJobs)).toEqual(['job-2'])
    })

    it('falls back to the history preview when the detail carries no outputs', async () => {
      followRun('job-1')
      vi.mocked(api.getJobDetail).mockResolvedValue(
        makeJob('job-1', 'completed')
      )
      vi.mocked(api.getHistory).mockResolvedValue([
        {
          ...makeJob('job-1', 'completed'),
          outputs_count: 1,
          preview_output: { ...image, nodeId: '9', mediaType: 'images' }
        }
      ])

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ node: '9' })]
      ])
    })

    it('keeps following a queued run whose outputs could not be fetched', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-0'] = { nodes: {} }
      vi.mocked(api.getHistory).mockResolvedValue([
        { ...makeJob('job-0', 'completed'), outputs_count: 3 }
      ])

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
      expect(Object.keys(executionStore.queuedJobs)).toEqual(['job-0'])
    })

    it('still files a background workflow run outputs when a new run took the open graph', async () => {
      const background = fromPartial<ComfyWorkflow>({
        path: 'workflows/other.json',
        changeTracker: { nodeOutputs: undefined }
      })
      followRun('job-1', background)
      const executionStore = useExecutionStore()
      vi.mocked(api.getJobDetail).mockImplementation(async () => {
        executionStore.activeJobId = 'job-new'
        return finishedJob
      })

      await useReconnectQueueRefresh()()

      expect(background.changeTracker?.nodeOutputs).toEqual({
        '9': { images: [image] }
      })
    })

    it('restores a run that finished during an interrupted refresh on the rerun, once', async () => {
      followRun('job-1')
      vi.mocked(api.getQueue)
        .mockResolvedValueOnce({
          Running: [makeJob('job-1', 'in_progress')],
          Pending: []
        })
        .mockResolvedValue({ Running: [], Pending: [] })
      vi.mocked(api.getJobDetail).mockResolvedValue(finishedJob)
      const refresh = useReconnectQueueRefresh()

      await Promise.all([refresh(), refresh()])

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ prompt_id: 'job-1' })]
      ])
      expect(useExecutionStore().activeJobId).toBeNull()
      expect(api.getQueue).toHaveBeenCalledTimes(2)
    })

    it('does not replay onto a queued run that started during the refresh', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-2'] = { nodes: {} }
      followRun('job-1')
      vi.mocked(api.getJobDetail).mockImplementation(async (jobId) => {
        if (jobId === 'job-2') return makeJob('job-2', 'in_progress')
        executionStore.activeJobId = 'job-2'
        return finishedJob
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
      expect(executionStore.activeJobId).toBe('job-2')
    })

    it('does not replay onto the open graph while another followed run is still live', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-0'] = { nodes: {} }
      followRun('job-1')
      vi.mocked(api.getQueue).mockResolvedValue({
        Running: [makeJob('job-1', 'in_progress')],
        Pending: []
      })
      vi.mocked(api.getJobDetail).mockResolvedValue({
        ...finishedJob,
        id: 'job-0'
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
      expect(executionStore.activeJobId).toBe('job-1')
      expect(Object.keys(executionStore.queuedJobs)).toEqual(['job-1'])
    })

    it('still replays onto the open graph when the live run belongs to a background workflow', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-0'] = { nodes: {} }
      followRun(
        'job-1',
        fromPartial<ComfyWorkflow>({ path: 'workflows/other.json' })
      )
      vi.mocked(api.getQueue).mockResolvedValue({
        Running: [makeJob('job-1', 'in_progress')],
        Pending: []
      })
      vi.mocked(api.getJobDetail).mockResolvedValue({
        ...finishedJob,
        id: 'job-0'
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ prompt_id: 'job-0' })]
      ])
    })

    it('still replays when the only change during the refresh was a run ending', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-0'] = { nodes: {} }
      followRun('job-1')
      vi.mocked(api.getJobDetail).mockImplementation(async (jobId) => {
        executionStore.activeJobId = null
        return { ...finishedJob, id: jobId }
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ prompt_id: 'job-0' })],
        ['executed', expect.objectContaining({ prompt_id: 'job-1' })]
      ])
    })

    it('does not replay over a run that started and finished during the refresh', async () => {
      followRun('job-1')
      const executionStore = useExecutionStore()
      vi.mocked(api.getJobDetail).mockImplementation(async () => {
        executionStore.activeJobId = 'job-quick'
        executionStore.activeJobId = null
        return finishedJob
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
    })

    it('does not replay a run the restored socket already finished during the refresh', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-0'] = { nodes: {} }
      vi.mocked(api.getJobDetail).mockImplementation(async () => {
        delete executionStore.queuedJobs['job-0']
        return { ...finishedJob, id: 'job-0' }
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
    })

    it('reads a fresh queue when a queue fetch was already in flight at reconnect', async () => {
      const queueStore = useQueueStore()
      vi.mocked(api.getQueue).mockResolvedValueOnce({
        Running: [makeJob('job-1', 'in_progress')],
        Pending: []
      })
      await queueStore.update()
      followRun('job-1')
      let answerStaleFetch!: () => void
      vi.mocked(api.getQueue)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              answerStaleFetch = () =>
                resolve({
                  Running: [makeJob('job-1', 'in_progress')],
                  Pending: []
                })
            })
        )
        .mockResolvedValue({ Running: [], Pending: [] })
      vi.mocked(api.getJobDetail).mockResolvedValue(finishedJob)
      const staleFetch = queueStore.update()

      const refreshed = useReconnectQueueRefresh()()
      answerStaleFetch()
      await Promise.all([staleFetch, refreshed])

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ prompt_id: 'job-1' })]
      ])
      expect(useExecutionStore().activeJobId).toBeNull()
    })

    describe('when the server cannot say what became of a run', () => {
      it('gives up on a job detail request that never answers', async () => {
        const executionStore = useExecutionStore()
        executionStore.queuedJobs['job-0'] = { nodes: {} }
        vi.mocked(api.getJobDetail).mockReturnValue(new Promise(() => {}))

        const refreshed = useReconnectQueueRefresh()()
        await vi.runAllTimersAsync()
        await refreshed

        expect(Object.keys(executionStore.queuedJobs)).toEqual(['job-0'])
      })

      it('aborts a job detail request it stopped waiting for', async () => {
        const executionStore = useExecutionStore()
        executionStore.queuedJobs['job-0'] = { nodes: {} }
        const signals: (AbortSignal | undefined)[] = []
        vi.mocked(api.getJobDetail).mockImplementation((_jobId, signal) => {
          signals.push(signal)
          return new Promise(() => {})
        })

        const refreshed = useReconnectQueueRefresh()()
        await vi.runAllTimersAsync()
        await refreshed

        expect(signals).toHaveLength(2)
        expect(signals.every((signal) => signal?.aborted)).toBe(true)
      })

      it('retries once, so a transient failure does not lose the active run outputs', async () => {
        followRun('job-1')
        vi.mocked(api.getJobDetail)
          .mockResolvedValueOnce(undefined)
          .mockResolvedValue(finishedJob)

        const refreshed = useReconnectQueueRefresh()()
        await vi.runAllTimersAsync()
        await refreshed

        expect(replayedExecutedFrames()).toEqual([
          ['executed', expect.objectContaining({ prompt_id: 'job-1' })]
        ])
      })

      it('stops following a run that stays unreadable across reconnects', async () => {
        const executionStore = useExecutionStore()
        executionStore.queuedJobs['job-0'] = { nodes: {} }
        const refresh = useReconnectQueueRefresh()

        const first = refresh()
        await vi.runAllTimersAsync()
        await first
        const second = refresh()
        await vi.runAllTimersAsync()
        await second
        expect(Object.keys(executionStore.queuedJobs)).toEqual(['job-0'])

        const third = refresh()
        await vi.runAllTimersAsync()
        await third
        expect(executionStore.queuedJobs).toEqual({})
      })
    })
  })
})
