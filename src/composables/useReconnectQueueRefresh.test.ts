import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
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
    useExecutionStore().bindExecutionEvents()
  })

  afterEach(() => {
    useExecutionStore().unbindExecutionEvents()
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

    function followRun(jobId: string) {
      const executionStore = useExecutionStore()
      executionStore.activeJobId = jobId
      executionStore.queuedJobs[jobId] = { nodes: {} }
    }

    function replayedExecutedFrames() {
      return vi
        .mocked(api.dispatchCustomEvent)
        .mock.calls.filter(([type]) => type === 'executed')
    }

    function replayedExecutionFrames() {
      return vi
        .mocked(api.dispatchCustomEvent)
        .mock.calls.filter(([type]) =>
          [
            'executed',
            'execution_success',
            'execution_error',
            'execution_interrupted'
          ].includes(type)
        )
    }

    it('replays the finished run outputs as executed frames', async () => {
      followRun('job-1')
      vi.mocked(api.getJobDetail).mockResolvedValue(finishedJob)

      await useReconnectQueueRefresh()()

      expect(api.getJobDetail).toHaveBeenCalledWith(
        'job-1',
        expect.any(AbortSignal)
      )
      expect(replayedExecutionFrames()).toEqual([
        [
          'executed',
          {
            node: '9',
            display_node: '9',
            output: { images: [image] },
            prompt_id: 'job-1'
          }
        ],
        [
          'execution_success',
          { prompt_id: 'job-1', timestamp: expect.any(Number) }
        ]
      ])
    })

    it('lets the terminal event clear the run after its output event', async () => {
      followRun('job-1')
      vi.mocked(api.getJobDetail).mockResolvedValue(finishedJob)
      const executionStore = useExecutionStore()

      await useReconnectQueueRefresh()()

      expect(replayedExecutionFrames().map(([type]) => type)).toEqual([
        'executed',
        'execution_success'
      ])
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

    it('dispatches a stored failure through the normal error handler', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-1'] = { nodes: {} }
      vi.mocked(api.getJobDetail).mockResolvedValue({
        ...finishedJob,
        status: 'failed',
        execution_error: {
          node_id: '9',
          node_type: 'SaveImage',
          exception_message: 'disk full',
          exception_type: 'OSError',
          traceback: ['trace']
        }
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([])
      expect(replayedExecutionFrames()).toEqual([
        [
          'execution_error',
          expect.objectContaining({
            prompt_id: 'job-1',
            node_id: '9',
            node_type: 'SaveImage',
            executed: [],
            exception_message: 'disk full',
            exception_type: 'OSError',
            traceback: ['trace'],
            timestamp: expect.any(Number)
          })
        ]
      ])
      expect(executionStore.queuedJobs).toEqual({})
    })

    it('dispatches a fallback error when a failed run has no stored error', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-1'] = { nodes: {} }
      vi.mocked(api.getJobDetail).mockResolvedValue({
        ...finishedJob,
        status: 'failed'
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutionFrames()).toEqual([
        [
          'execution_error',
          expect.objectContaining({
            prompt_id: 'job-1',
            exception_message:
              'The job failed while the live connection was unavailable.',
            exception_type: ''
          })
        ]
      ])
    })

    it('dispatches a cancelled run through the normal interruption handler', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-1'] = { nodes: {} }
      vi.mocked(api.getJobDetail).mockResolvedValue({
        ...finishedJob,
        status: 'cancelled'
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutionFrames()).toEqual([
        [
          'execution_interrupted',
          {
            prompt_id: 'job-1',
            timestamp: expect.any(Number),
            node_id: '',
            node_type: '',
            executed: []
          }
        ]
      ])
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

    it('routes recovered output by job when another run starts during the fetch', async () => {
      followRun('job-1')
      const executionStore = useExecutionStore()
      vi.mocked(api.getJobDetail).mockImplementation(async () => {
        executionStore.activeJobId = 'job-new'
        executionStore.queuedJobs['job-new'] = { nodes: {} }
        return finishedJob
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ prompt_id: 'job-1' })]
      ])
      expect(executionStore.activeJobId).toBe('job-new')
      expect(Object.keys(executionStore.queuedJobs)).toContain('job-new')
    })

    it.for([
      { name: 'the recovered run is adopted', activeJobId: 'job-1' },
      { name: 'the active run ends', activeJobId: null }
    ])('still restores output when $name during refresh', async (scenario) => {
      followRun('job-1')
      const executionStore = useExecutionStore()
      vi.mocked(api.getJobDetail).mockImplementation(async () => {
        executionStore.activeJobId = scenario.activeJobId
        return finishedJob
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ prompt_id: 'job-1' })]
      ])
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

    it('does not clear a queued run that started during the refresh', async () => {
      const executionStore = useExecutionStore()
      executionStore.queuedJobs['job-2'] = { nodes: {} }
      followRun('job-1')
      vi.mocked(api.getJobDetail).mockImplementation(async (jobId) => {
        if (jobId === 'job-2') return makeJob('job-2', 'in_progress')
        executionStore.activeJobId = 'job-2'
        return finishedJob
      })

      await useReconnectQueueRefresh()()

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ prompt_id: 'job-1' })]
      ])
      expect(executionStore.activeJobId).toBe('job-2')
    })

    it('does not clear another followed run that is still live', async () => {
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

      expect(replayedExecutedFrames()).toEqual([
        ['executed', expect.objectContaining({ prompt_id: 'job-0' })]
      ])
      expect(executionStore.activeJobId).toBe('job-1')
      expect(Object.keys(executionStore.queuedJobs)).toEqual(['job-1'])
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

      it.for([
        {
          name: 'a queued run',
          follow: (jobId: string) => {
            useExecutionStore().queuedJobs[jobId] = { nodes: {} }
          },
          expectedActiveJobId: null
        },
        {
          name: 'the active run history still lists',
          follow: (jobId: string) => {
            followRun(jobId)
            vi.mocked(api.getHistory).mockResolvedValue([
              { ...makeJob(jobId, 'completed'), outputs_count: 3 }
            ])
          },
          expectedActiveJobId: 'job-0'
        }
      ])(
        'stops following $name only after it stays unreadable across three reconnects',
        async ({ follow, expectedActiveJobId }) => {
          const executionStore = useExecutionStore()
          follow('job-0')
          const refresh = useReconnectQueueRefresh()

          const first = refresh()
          await vi.runAllTimersAsync()
          await first
          const second = refresh()
          await vi.runAllTimersAsync()
          await second
          expect(Object.keys(executionStore.queuedJobs)).toEqual(['job-0'])
          expect(executionStore.activeJobId).toBe(expectedActiveJobId)

          const third = refresh()
          await vi.runAllTimersAsync()
          await third
          expect(executionStore.queuedJobs).toEqual({})
          expect(executionStore.activeJobId).toBeNull()
        }
      )

      it('clears an active run the server lists nowhere on the first reconnect', async () => {
        const executionStore = useExecutionStore()
        followRun('job-0')

        const refreshed = useReconnectQueueRefresh()()
        await vi.runAllTimersAsync()
        await refreshed

        expect(executionStore.activeJobId).toBeNull()
        expect(executionStore.queuedJobs).toEqual({})
      })
    })
  })
})
