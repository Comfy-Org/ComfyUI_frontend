import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readExperimentVariant } from '@/platform/experiments/postHogExperimentClient'
import { reportError } from '@/platform/telemetry/reportError'

import { useFreeUsePlacement } from './freeUsePlacement'

vi.mock(import('@/platform/experiments/postHogExperimentClient'))
vi.mock(import('@/platform/telemetry/reportError'))

describe('useFreeUsePlacement', () => {
  beforeEach(() => {
    vi.mocked(readExperimentVariant).mockResolvedValue('control')
  })

  it('uses a known assignment after the read settles', async () => {
    const read = Promise.resolve('above-input')
    vi.mocked(readExperimentVariant).mockReturnValue(read)
    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    await read
    expect(variant.value).toBe('above-input')
  })

  it.for([undefined, 'unknown'])('keeps control for %s', async (value) => {
    const read = Promise.resolve(value)
    vi.mocked(readExperimentVariant).mockReturnValue(read)
    const { variant } = useFreeUsePlacement()

    await read
    expect(variant.value).toBe('control')
  })

  it('keeps control and reports a failed read', async () => {
    const error = new Error('PostHog unavailable')
    const read = Promise.reject(error)
    vi.mocked(readExperimentVariant).mockReturnValue(read)
    const { variant } = useFreeUsePlacement()

    await read.catch(() => undefined)
    expect(variant.value).toBe('control')
    expect(reportError).toHaveBeenCalledWith(error, {
      surface: 'platform',
      errorType: 'experiment_assignment_failed',
      tags: { flag_key: 'agent-free-use-message-placement' },
      level: 'warning'
    })
  })
})
