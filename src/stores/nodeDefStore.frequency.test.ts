import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'

import nodeFrequencies from '../../public/assets/sorted-custom-node-map.json' with { type: 'json' }
import { reportError } from '@/platform/telemetry/reportError'
import { useNodeFrequencyStore } from '@/stores/nodeDefStore'

vi.mock(import('@/platform/telemetry/reportError'))

describe('useNodeFrequencyStore', () => {
  it('loads independent rankings for both Save Image node definitions', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({ data: nodeFrequencies })
    const store = useNodeFrequencyStore()

    await store.loadNodeFrequencies()

    expect(store.getNodeFrequencyByName('SaveImage')).toBe(1762)
    expect(store.getNodeFrequencyByName('SaveImageAdvanced')).toBe(4300)
  })

  it('reports a load failure and stays retryable', async () => {
    const failure = new Error('frequencies unavailable')
    vi.spyOn(axios, 'get').mockRejectedValue(failure)
    const store = useNodeFrequencyStore()

    await store.loadNodeFrequencies()

    expect(store.isLoaded).toBe(false)
    expect(reportError).toHaveBeenCalledWith(failure, {
      errorType: 'node_frequency_load_failure',
      surface: 'workspace'
    })
  })
})
