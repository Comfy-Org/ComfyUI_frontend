import { describe, expect, it } from 'vitest'

import {
  createTemplateModelDownloadState,
  getTemplateModelDownloadIdentity,
  reduceTemplateModelDownloadState
} from '@/platform/workflow/templates/utils/templateModelDownloadState'

describe('template model download state', () => {
  it('identifies models by exact name and directory', () => {
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

  it('assigns a monotonic attempt and ignores repeated active requests', () => {
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

  it('keeps exact nullable progress and requires explicit completion', () => {
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
    (type) => {
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
        reason: type
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
