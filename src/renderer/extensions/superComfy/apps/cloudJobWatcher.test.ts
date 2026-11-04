import type { TaskOutput } from '@comfyorg/api-client/executionTypes'
import type { JobDetail, JobStatus } from '@comfyorg/api-client/jobTypes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { watchCloudJob } from '@/renderer/extensions/superComfy/apps/cloudJobWatcher'
import { api } from '@/scripts/api'

const OUTPUTS: TaskOutput = {
  '9': { images: [{ filename: 'a.png', subfolder: '', type: 'output' }] }
}

function job(status: JobStatus, overrides: Partial<JobDetail> = {}): JobDetail {
  return {
    id: 'job-1',
    status,
    create_time: 0,
    outputs_count: null,
    previewable_outputs_count: null,
    ...overrides
  }
}

function watch(signal: AbortSignal = new AbortController().signal) {
  const onProgress = vi.fn()
  const outcome = watchCloudJob({
    promptId: 'job-1',
    signal,
    onProgress,
    hasOutputs: (detail) => Object.keys(detail.outputs ?? {}).length > 0
  })
  return { outcome, onProgress }
}

beforeEach(() => {
  vi.spyOn(api, 'cancelJob').mockResolvedValue()
  vi.spyOn(api, 'interrupt').mockResolvedValue()
  vi.spyOn(api, 'deleteItem').mockResolvedValue()
})

describe('watchCloudJob', () => {
  it('resolves with the job once it completes with outputs', async () => {
    const completed = job('completed', { outputs: OUTPUTS })
    vi.spyOn(api, 'getJobDetail')
      .mockResolvedValueOnce(job('pending'))
      .mockResolvedValueOnce(completed)

    const { outcome } = watch()
    await vi.advanceTimersByTimeAsync(2000)

    await expect(outcome).resolves.toEqual({ ok: true, detail: completed })
  })

  it('keeps waiting while the job is not visible yet', async () => {
    const completed = job('completed', { outputs: OUTPUTS })
    const getJobDetail = vi
      .spyOn(api, 'getJobDetail')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(completed)

    const { outcome } = watch()
    await vi.advanceTimersByTimeAsync(2000 + 3000)

    await expect(outcome).resolves.toEqual({ ok: true, detail: completed })
    expect(getJobDetail).toHaveBeenCalledTimes(3)
  })

  it('fails with the server error and node type of a failed job', async () => {
    vi.spyOn(api, 'getJobDetail').mockResolvedValue(
      job('failed', {
        execution_error: {
          node_id: '3',
          node_type: 'KSampler',
          exception_message: 'CUDA out of memory',
          exception_type: 'RuntimeError',
          traceback: []
        }
      })
    )

    const { outcome } = watch()

    await expect(outcome).resolves.toEqual({
      ok: false,
      message: 'CUDA out of memory (KSampler)'
    })
  })

  it('fails a cancelled job', async () => {
    vi.spyOn(api, 'getJobDetail').mockResolvedValue(job('cancelled'))

    const { outcome } = watch()

    await expect(outcome).resolves.toMatchObject({ ok: false })
  })

  it('checks the job straight away when its terminal event arrives', async () => {
    const completed = job('completed', { outputs: OUTPUTS })
    const getJobDetail = vi
      .spyOn(api, 'getJobDetail')
      .mockResolvedValueOnce(job('in_progress'))
      .mockResolvedValueOnce(completed)
    const { outcome } = watch()
    await vi.advanceTimersByTimeAsync(0)

    api.dispatchCustomEvent('execution_success', {
      prompt_id: 'job-1',
      timestamp: 0
    })
    await vi.advanceTimersByTimeAsync(0)

    expect(getJobDetail).toHaveBeenCalledTimes(2)
    await expect(outcome).resolves.toEqual({ ok: true, detail: completed })
  })

  it('ignores terminal events of other prompts', async () => {
    const getJobDetail = vi
      .spyOn(api, 'getJobDetail')
      .mockResolvedValue(job('in_progress'))
    watch()
    await vi.advanceTimersByTimeAsync(0)

    api.dispatchCustomEvent('execution_success', {
      prompt_id: 'job-2',
      timestamp: 0
    })
    await vi.advanceTimersByTimeAsync(0)

    expect(getJobDetail).toHaveBeenCalledOnce()
  })

  it('reports progress from its own progress events only', async () => {
    vi.spyOn(api, 'getJobDetail').mockResolvedValue(job('in_progress'))
    const { onProgress } = watch()
    await vi.advanceTimersByTimeAsync(0)
    const node = (state: 'finished' | 'running') => ({
      value: 0,
      max: 1,
      state,
      node_id: '1',
      prompt_id: 'job-1'
    })

    api.dispatchCustomEvent('progress_state', {
      prompt_id: 'job-2',
      nodes: { '1': node('finished') }
    })
    api.dispatchCustomEvent('progress_state', {
      prompt_id: 'job-1',
      nodes: {
        '1': node('finished'),
        '2': node('running'),
        '3': node('running'),
        '4': node('running')
      }
    })

    expect(onProgress.mock.calls).toEqual([[0.25]])
  })

  it('cancels and interrupts a running job when stopped', async () => {
    vi.spyOn(api, 'getJobDetail').mockResolvedValue(job('in_progress'))
    const controller = new AbortController()
    const { outcome } = watch(controller.signal)
    await vi.advanceTimersByTimeAsync(0)

    controller.abort()

    await expect(outcome).resolves.toMatchObject({ ok: false })
    expect(api.cancelJob).toHaveBeenCalledWith('job-1')
    expect(api.interrupt).toHaveBeenCalledWith('job-1')
  })

  it('cancels a queued job without interrupting the running one', async () => {
    vi.spyOn(api, 'getJobDetail').mockResolvedValue(job('pending'))
    const controller = new AbortController()
    const { outcome } = watch(controller.signal)
    await vi.advanceTimersByTimeAsync(0)

    controller.abort()

    await expect(outcome).resolves.toMatchObject({ ok: false })
    expect(api.cancelJob).toHaveBeenCalledWith('job-1')
    expect(api.interrupt).not.toHaveBeenCalled()
  })

  it('removes a queued job from the queue when the cancel route is missing', async () => {
    vi.spyOn(api, 'getJobDetail').mockResolvedValue(job('pending'))
    vi.mocked(api.cancelJob).mockRejectedValue(new Error('404'))
    const controller = new AbortController()
    const { outcome } = watch(controller.signal)
    await vi.advanceTimersByTimeAsync(0)

    controller.abort()
    await outcome

    expect(api.deleteItem).toHaveBeenCalledWith('queue', 'job-1')
  })

  it('fetches a completed job again before deciding it had no output', async () => {
    const completed = job('completed', { outputs: OUTPUTS })
    vi.spyOn(api, 'getJobDetail')
      .mockResolvedValueOnce(job('completed'))
      .mockResolvedValueOnce(job('completed'))
      .mockResolvedValueOnce(completed)

    const { outcome } = watch()
    await vi.advanceTimersByTimeAsync(2000)

    await expect(outcome).resolves.toEqual({ ok: true, detail: completed })
  })

  it('fails as no output after three empty re-fetches', async () => {
    const getJobDetail = vi
      .spyOn(api, 'getJobDetail')
      .mockResolvedValue(job('completed'))

    const { outcome } = watch()
    await vi.advanceTimersByTimeAsync(3000)

    await expect(outcome).resolves.toMatchObject({ ok: false })
    expect(getJobDetail).toHaveBeenCalledTimes(4)
  })

  it('gives up and cancels after thirty minutes', async () => {
    vi.spyOn(api, 'getJobDetail').mockResolvedValue(job('pending'))

    const { outcome } = watch()
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)

    await expect(outcome).resolves.toMatchObject({ ok: false })
    expect(api.cancelJob).toHaveBeenCalledWith('job-1')
  })
})
