import { describe, expect, it, vi } from 'vitest'

import { ComfyApi } from './ComfyApi'

function createApi(isCloud: boolean) {
  const api = new ComfyApi({
    isCloud,
    featureFlagOverride: () => undefined,
    onFreeMemory: () => {}
  })
  const fetchApi = vi.spyOn(api, 'fetchApi').mockImplementation(async () =>
    Response.json({
      jobs: [],
      pagination: { offset: 0, limit: 200, total: 0, has_more: false }
    })
  )
  return { api, fetchApi }
}

function cappedTotalParam(url: string) {
  return new URL(url, 'http://localhost').searchParams.get('capped_total')
}

describe('ComfyApi job lists', () => {
  it.for([
    { runtime: 'cloud', isCloud: true, expected: 'true' },
    { runtime: 'local', isCloud: false, expected: null }
  ])(
    'sends capped_total=$expected on $runtime',
    async ({ isCloud, expected }) => {
      const { api, fetchApi } = createApi(isCloud)

      await api.getQueue({ throwOnError: true })
      await api.getHistory(200, { throwOnError: true })

      const urls = fetchApi.mock.calls.map(([url]) => url)
      expect(urls).toHaveLength(2)
      expect(urls.map(cappedTotalParam)).toEqual([expected, expected])
    }
  )
})
