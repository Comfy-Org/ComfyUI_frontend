import { omit } from 'es-toolkit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import type { ModelDownloadData } from '@comfyorg/ingest-types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'
import { useJobModelDownloadStore } from '@/stores/jobModelDownloadStore'

vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'), { spy: true })

function message(
  overrides: Partial<ModelDownloadData> = {}
): ModelDownloadData {
  return {
    status: 'downloading',
    name: 'my_style_v2.safetensors',
    dir: 'loras',
    index: 1,
    count: 1,
    bytes_downloaded: 52428800,
    bytes_total: 152043520,
    progress: 0.3448,
    prompt_id: 'job-1',
    workflow_id: 'wf-1',
    ...overrides
  }
}

function dispatch(msg: ModelDownloadData) {
  api.dispatchCustomEvent('model_download', msg)
}

describe('useJobModelDownloadStore', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockImplementation(() => undefined)
  })

  it('keeps the latest download state of each job', () => {
    const store = useJobModelDownloadStore()

    dispatch(message({ bytes_downloaded: 0, progress: 0 }))
    dispatch(message())
    dispatch(message({ prompt_id: 'job-2', name: 'other.safetensors' }))

    expect(store.downloadFor('job-1')).toEqual({
      name: 'my_style_v2.safetensors',
      index: 1,
      count: 1,
      bytesDownloaded: 52428800,
      bytesTotal: 152043520,
      progress: 0.3448
    })
    expect(store.downloadFor('job-2')?.name).toBe('other.safetensors')
  })

  it.for(['done', 'cached', 'failed'] as const)(
    'stops showing the download once the file is %s',
    (status) => {
      const store = useJobModelDownloadStore()
      dispatch(message())

      dispatch(message({ status, bytes_downloaded: 152043520, progress: 1 }))

      expect(store.downloadFor('job-1')).toBeUndefined()
    }
  )

  it.for([
    'execution_start',
    'execution_success',
    'execution_error',
    'execution_interrupted'
  ] as const)('ends the download on %s for that job only', (type) => {
    const store = useJobModelDownloadStore()
    dispatch(message())
    dispatch(message({ prompt_id: 'job-2' }))

    api.dispatchCustomEvent(type, { prompt_id: 'job-1', timestamp: 1 })

    expect(store.downloadFor('job-1')).toBeUndefined()
    expect(store.downloadFor('job-2')).toBeDefined()
  })

  it.for([
    {
      type: 'progress',
      send: () =>
        api.dispatchCustomEvent('progress', {
          prompt_id: 'job-1',
          node: '1',
          value: 7,
          max: 10
        })
    },
    {
      type: 'progress_state',
      send: () =>
        api.dispatchCustomEvent('progress_state', {
          prompt_id: 'job-1',
          nodes: {
            '1': {
              value: 7,
              max: 10,
              state: 'running',
              node_id: '1',
              prompt_id: 'job-1'
            }
          }
        })
    }
  ])(
    'ends the download on $type for that job when execution_start was missed',
    ({ send }) => {
      const store = useJobModelDownloadStore()
      dispatch(message())
      dispatch(message({ prompt_id: 'job-2' }))
      store.reconcileActiveJobs(new Set(['job-1', 'job-2']))

      send()

      expect(store.downloadFor('job-1')).toBeUndefined()
      expect(store.downloadFor('job-2')).toBeDefined()
    }
  )

  it('updates a consumer created before the download events', () => {
    const store = useJobModelDownloadStore()
    const progress = computed(() => store.downloadFor('job-1')?.progress)
    expect(progress.value).toBeUndefined()

    dispatch(message())
    expect(progress.value).toBe(0.3448)

    dispatch(message({ progress: 0.75 }))
    expect(progress.value).toBe(0.75)

    api.dispatchCustomEvent('execution_start', {
      prompt_id: 'job-1',
      timestamp: 1
    })
    expect(progress.value).toBeUndefined()
  })

  it('drops downloads of jobs the queue no longer lists', () => {
    const store = useJobModelDownloadStore()
    dispatch(message())
    dispatch(message({ prompt_id: 'job-2' }))

    store.reconcileActiveJobs(new Set(['job-2']))

    expect(store.downloadFor('job-1')).toBeUndefined()
    expect(store.downloadFor('job-2')).toBeDefined()
  })

  it('ends the download on a status it does not know, without a report', () => {
    const store = useJobModelDownloadStore()
    dispatch(message())

    dispatch(message({ status: 'verifying' }))

    expect(store.downloadFor('job-1')).toBeUndefined()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('shows a download whose frame drops the fields it does not read or adds new ones', () => {
    const store = useJobModelDownloadStore()
    const detail = {
      ...omit(message(), ['dir', 'workflow_id']),
      eta_seconds: 12
    }

    const apiEvents: EventTarget = api
    apiEvents.dispatchEvent(new CustomEvent('model_download', { detail }))

    expect(store.downloadFor('job-1')?.progress).toBe(0.3448)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('ignores a malformed event and reports the first one', () => {
    const store = useJobModelDownloadStore()

    const malformed: unknown = { prompt_id: 'job-1' }
    const apiEvents: EventTarget = api
    apiEvents.dispatchEvent(
      new CustomEvent('model_download', { detail: malformed })
    )
    apiEvents.dispatchEvent(
      new CustomEvent('model_download', { detail: malformed })
    )

    expect(store.downloadFor('job-1')).toBeUndefined()
    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorType: 'error_parsing_model_download_message'
      })
    )
  })
})
