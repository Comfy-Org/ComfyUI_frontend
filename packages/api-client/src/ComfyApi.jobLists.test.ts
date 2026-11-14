import { describe, expect, it, vi } from 'vitest'

import { ComfyApi } from './ComfyApi'
import type { ComfyApiPorts } from './ComfyApi'

vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const loadHistory = (api: ComfyApi) => api.getHistory()
const loadQueue = (api: ComfyApi) => api.getQueue()

describe('ComfyApi job lists', () => {
  it.for([
    { isCloud: true, list: 'history', load: loadHistory, cappedTotal: 'true' },
    { isCloud: true, list: 'queue', load: loadQueue, cappedTotal: 'true' },
    { isCloud: false, list: 'history', load: loadHistory, cappedTotal: null },
    { isCloud: false, list: 'queue', load: loadQueue, cappedTotal: null }
  ])(
    'sends capped_total=$cappedTotal for the $list list when isCloud is $isCloud',
    async ({ isCloud, load, cappedTotal }) => {
      const ports: ComfyApiPorts = {
        isCloud,
        featureFlagOverride: () => undefined,
        onFreeMemory: () => {}
      }
      const api = new ComfyApi(ports)
      const fetchApi = vi.spyOn(api, 'fetchApi').mockResolvedValue(
        Response.json({
          jobs: [],
          pagination: { offset: 0, limit: 200, total: 0, has_more: false }
        })
      )

      await load(api)

      const [url] = fetchApi.mock.calls[0]
      expect(
        new URL(url, 'http://localhost').searchParams.get('capped_total')
      ).toBe(cappedTotal)
    }
  )
})
