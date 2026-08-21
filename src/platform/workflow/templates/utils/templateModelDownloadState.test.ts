import { describe, expect, it } from 'vitest'

type TemplateModelDownloadState =
  | { status: 'idle'; attempt: 0 }
  | { status: 'queued'; attempt: number }
  | { status: 'starting'; attempt: number }
  | {
      status: 'downloading'
      attempt: number
      activity: 'active' | 'paused'
      receivedBytes: number | null
      totalBytes: number | null
      fraction: number | null
    }
  | { status: 'done'; attempt: number }
  | {
      status: 'failed'
      attempt: number
      reason: 'error' | 'cancelled'
      retryable: true
    }

type TemplateModelDownloadEvent =
  | { type: 'request' }
  | { type: 'started'; attempt: number }
  | {
      type: 'progress'
      attempt: number
      activity: 'active' | 'paused'
      receivedBytes: number | null
      totalBytes: number | null
      fraction: number | null
    }
  | { type: 'completed'; attempt: number }
  | { type: 'error' | 'cancelled'; attempt: number }

type TemplateModelDownloadStateModule = {
  createTemplateModelDownloadState: () => TemplateModelDownloadState
  getTemplateModelDownloadIdentity: (model: {
    name: string
    directory: string
  }) => string
  reduceTemplateModelDownloadState: (
    state: TemplateModelDownloadState,
    event: TemplateModelDownloadEvent
  ) => TemplateModelDownloadState
}

function isStateModule(
  value: unknown
): value is TemplateModelDownloadStateModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    'createTemplateModelDownloadState' in value &&
    typeof value.createTemplateModelDownloadState === 'function' &&
    'getTemplateModelDownloadIdentity' in value &&
    typeof value.getTemplateModelDownloadIdentity === 'function' &&
    'reduceTemplateModelDownloadState' in value &&
    typeof value.reduceTemplateModelDownloadState === 'function'
  )
}

async function loadStateModule(): Promise<TemplateModelDownloadStateModule> {
  const modulePath = './templateModelDownloadState'
  const value: unknown = await import(modulePath)
  if (!isStateModule(value)) {
    throw new Error('Expected the template model download state module')
  }
  return value
}

describe('template model download state', () => {
  it('identifies models by exact name and directory', async () => {
    const { getTemplateModelDownloadIdentity } = await loadStateModule()

    const checkpoint = getTemplateModelDownloadIdentity({
      name: 'shared/name.safetensors',
      directory: 'checkpoints'
    })
    const checkpointCopy = getTemplateModelDownloadIdentity({
      name: 'shared/name.safetensors',
      directory: 'checkpoints'
    })
    const lora = getTemplateModelDownloadIdentity({
      name: 'shared/name.safetensors',
      directory: 'loras'
    })

    expect(checkpoint).toBe(
      JSON.stringify(['shared/name.safetensors', 'checkpoints'])
    )
    expect(checkpointCopy).toBe(checkpoint)
    expect(lora).not.toBe(checkpoint)
  })

  it('assigns a monotonic attempt and ignores repeated active requests', async () => {
    const {
      createTemplateModelDownloadState,
      reduceTemplateModelDownloadState
    } = await loadStateModule()
    const idle = createTemplateModelDownloadState()

    expect(idle).toEqual({ status: 'idle', attempt: 0 })
    const queued = reduceTemplateModelDownloadState(idle, { type: 'request' })
    expect(queued).toEqual({ status: 'queued', attempt: 1 })
    expect(reduceTemplateModelDownloadState(queued, { type: 'request' })).toBe(
      queued
    )

    const starting = reduceTemplateModelDownloadState(queued, {
      type: 'started',
      attempt: 1
    })
    expect(starting).toEqual({ status: 'starting', attempt: 1 })
    expect(
      reduceTemplateModelDownloadState(starting, { type: 'request' })
    ).toBe(starting)

    const downloading = reduceTemplateModelDownloadState(starting, {
      type: 'progress',
      attempt: 1,
      activity: 'active',
      receivedBytes: null,
      totalBytes: null,
      fraction: null
    })
    expect(
      reduceTemplateModelDownloadState(downloading, { type: 'request' })
    ).toBe(downloading)
  })

  it('keeps exact nullable progress and requires explicit completion', async () => {
    const {
      createTemplateModelDownloadState,
      reduceTemplateModelDownloadState
    } = await loadStateModule()
    const queued = reduceTemplateModelDownloadState(
      createTemplateModelDownloadState(),
      { type: 'request' }
    )
    const starting = reduceTemplateModelDownloadState(queued, {
      type: 'started',
      attempt: 1
    })
    const fullyReceived = reduceTemplateModelDownloadState(starting, {
      type: 'progress',
      attempt: 1,
      activity: 'paused',
      receivedBytes: 1024,
      totalBytes: 1024,
      fraction: 1
    })

    expect(fullyReceived).toEqual({
      status: 'downloading',
      attempt: 1,
      activity: 'paused',
      receivedBytes: 1024,
      totalBytes: 1024,
      fraction: 1
    })
    expect(
      reduceTemplateModelDownloadState(fullyReceived, {
        type: 'completed',
        attempt: 1
      })
    ).toEqual({ status: 'done', attempt: 1 })
  })

  it.for(['error', 'cancelled'] as const)(
    'makes %s retryable and ignores stale attempt events',
    async (type) => {
      const {
        createTemplateModelDownloadState,
        reduceTemplateModelDownloadState
      } = await loadStateModule()
      const queued = reduceTemplateModelDownloadState(
        createTemplateModelDownloadState(),
        { type: 'request' }
      )
      const failed = reduceTemplateModelDownloadState(queued, {
        type,
        attempt: 1
      })

      expect(failed).toEqual({
        status: 'failed',
        attempt: 1,
        reason: type,
        retryable: true
      })
      const retried = reduceTemplateModelDownloadState(failed, {
        type: 'request'
      })
      expect(retried).toEqual({ status: 'queued', attempt: 2 })
      expect(
        reduceTemplateModelDownloadState(retried, {
          type: 'completed',
          attempt: 1
        })
      ).toBe(retried)
    }
  )
})
