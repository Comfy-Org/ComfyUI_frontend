import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeFrequencyStore } from '@/stores/nodeDefStore'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

describe('useNodeFrequencyStore', () => {
  let store: ReturnType<typeof useNodeFrequencyStore>

  beforeEach(() => {
    store = useNodeFrequencyStore()
  })

  it('reports a node frequency load failure', async () => {
    const failure = new Error('frequencies unavailable')
    vi.spyOn(axios, 'get').mockRejectedValue(failure)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await store.loadNodeFrequencies()

    expect(mockReportError).toHaveBeenCalledWith(failure, {
      errorType: 'node_frequency_load_failure'
    })
    expect(store.nodeNamesByFrequency).toEqual([])
  })
})
