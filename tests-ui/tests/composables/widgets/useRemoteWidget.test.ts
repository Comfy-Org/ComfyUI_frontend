import axios from 'axios'

import { useRemoteWidget } from '@/composables/widgets/useRemoteWidget'
import type { ComboInputSpecV2 } from '@/types/apiTypes'

jest.mock('axios', () => ({
  get: jest.fn()
}))

jest.mock('@/i18n', () => ({
  i18n: {
    global: {
      t: jest.fn((key) => key)
    }
  }
}))

jest.mock('@/stores/settingStore', () => ({
  useSettingStore: () => ({
    settings: {}
  })
}))

jest.mock('@/stores/widgetStore', () => ({
  useWidgetStore: () => ({
    widgets: {},
    getDefaultValue: jest.fn().mockReturnValue('Loading...')
  })
}))

const FIRST_BACKOFF = 1000 // backoff is 1s on first retry

function createMockInputData(overrides = {}): ComboInputSpecV2 {
  return [
    'COMBO',
    {
      name: 'test_widget',
      remote: {
        route: `/api/test/${Date.now()}${Math.random().toString(36).substring(2, 15)}`,
        refresh: 0,
        ...overrides
      }
    }
  ]
}

function mockAxiosResponse(data: unknown, status = 200) {
  jest.mocked(axios.get).mockResolvedValueOnce({ data, status })
}

function mockAxiosError(error: Error | string) {
  const err = error instanceof Error ? error : new Error(error)
  jest.mocked(axios.get).mockRejectedValueOnce(err)
}

function createHookWithData(data: unknown, inputOverrides = {}) {
  mockAxiosResponse(data)
  const hook = useRemoteWidget(createMockInputData(inputOverrides))
  return hook
}

async function setupHookWithResponse(data: unknown, inputOverrides = {}) {
  const hook = createHookWithData(data, inputOverrides)
  const result = await hook.fetchOptions()
  return { hook, result }
}

describe('useRemoteWidget', () => {
  let mockInputData: ComboInputSpecV2

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mocks
    jest.mocked(axios.get).mockReset()
    // Reset cache between tests
    jest.spyOn(Map.prototype, 'get').mockClear()
    jest.spyOn(Map.prototype, 'set').mockClear()
    jest.spyOn(Map.prototype, 'delete').mockClear()

    mockInputData = createMockInputData()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should create hook with default values', () => {
      const hook = useRemoteWidget(mockInputData)
      expect(hook.getCacheEntry()).toBeUndefined()
      expect(hook.defaultValue).toBe('Loading...')
    })

    it('should generate consistent cache keys', () => {
      const hook1 = useRemoteWidget(mockInputData)
      const hook2 = useRemoteWidget(mockInputData)
      expect(hook1.getCacheKey()).toBe(hook2.getCacheKey())
    })

    it('should handle query params in cache key', () => {
      const hook1 = useRemoteWidget(
        createMockInputData({ query_params: { a: 1 } })
      )
      const hook2 = useRemoteWidget(
        createMockInputData({ query_params: { a: 2 } })
      )
      expect(hook1.getCacheKey()).not.toBe(hook2.getCacheKey())
    })
  })

  describe('fetchOptions', () => {
    it('should fetch data successfully', async () => {
      const mockData = ['optionA', 'optionB']
      const { hook, result } = await setupHookWithResponse(mockData)
      expect(result).toEqual(mockData)
      expect(jest.mocked(axios.get)).toHaveBeenCalledWith(
        hook.getCacheKey().split(';')[0], // Get the route part from cache key
        expect.any(Object)
      )
    })

    it('should use response_key if provided', async () => {
      const mockResponse = { items: ['optionB', 'optionA', 'optionC'] }
      const { result } = await setupHookWithResponse(mockResponse, {
        response_key: 'items'
      })
      expect(result).toEqual(mockResponse.items)
    })

    it('should cache successful responses', async () => {
      const mockData = ['optionA', 'optionB', 'optionC', 'optionD']
      const { hook } = await setupHookWithResponse(mockData)
      const entry = hook.getCacheEntry()

      expect(entry?.data).toEqual(mockData)
      expect(entry?.error).toBeNull()
    })

    it('should handle fetch errors', async () => {
      const error = new Error('Network error')
      mockAxiosError(error)

      const hook = useRemoteWidget(mockInputData)
      const data = await hook.fetchOptions()
      expect(data).toBe('Loading...')

      const entry = hook.getCacheEntry()
      expect(entry?.error).toBeTruthy()
      expect(entry?.lastErrorTime).toBeDefined()
    })

    it('should handle empty array responses', async () => {
      const { result } = await setupHookWithResponse([])
      expect(result).toEqual([])
    })

    it('should handle malformed response data', async () => {
      const hook = useRemoteWidget(mockInputData)
      const { defaultValue } = hook

      mockAxiosResponse(null)
      const data1 = await hook.fetchOptions()

      mockAxiosResponse(undefined)
      const data2 = await hook.fetchOptions()

      expect(data1).toBe(defaultValue)
      expect(data2).toBe(defaultValue)
    })

    it('should handle non-200 status codes', async () => {
      mockAxiosError('Request failed with status code 404')

      const hook = useRemoteWidget(mockInputData)
      const data = await hook.fetchOptions()

      expect(data).toBe('Loading...')
      const entry = hook.getCacheEntry()
      expect(entry?.error?.message).toBe('Request failed with status code 404')
    })
  })

  describe('refresh behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
      jest.clearAllMocks()
    })

    describe('permanent widgets (no refresh)', () => {
      it('permanent widgets should not attempt fetch after initialization', async () => {
        const mockData = ['data that is permanent after initialization']
        const { hook } = await setupHookWithResponse(mockData)

        await hook.fetchOptions()
        await hook.fetchOptions()

        expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)
      })

      it('permanent widgets should re-fetch if forceUpdate is called', async () => {
        const mockData = ['data that is permanent after initialization']
        const { hook } = await setupHookWithResponse(mockData)

        await hook.fetchOptions()
        const refreshedData = ['data that user forced to be fetched']
        mockAxiosResponse(refreshedData)

        await hook.forceUpdate()
        const data = await hook.fetchOptions()
        expect(data).toEqual(refreshedData)
      })

      it('permanent widgets should still retry if request fails', async () => {
        mockAxiosError('Network error')

        const hook = useRemoteWidget(mockInputData)
        await hook.fetchOptions()
        expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)

        jest.setSystemTime(Date.now() + FIRST_BACKOFF)
        const secondData = await hook.fetchOptions()
        expect(secondData).toBe('Loading...')
        expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(2)
      })

      it('should treat empty refresh field as permanent', async () => {
        const { hook } = await setupHookWithResponse(['data that is permanent'])

        await hook.fetchOptions()
        await hook.fetchOptions()

        expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)
      })
    })

    it('should refresh when data is stale', async () => {
      const refresh = 256
      const mockData1 = ['option1']
      const mockData2 = ['option2']

      const { hook } = await setupHookWithResponse(mockData1, { refresh })
      mockAxiosResponse(mockData2)

      jest.setSystemTime(Date.now() + refresh)
      const newData = await hook.fetchOptions()

      expect(newData).toEqual(mockData2)
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(2)
    })

    it('should not refresh when data is not stale', async () => {
      const { hook } = await setupHookWithResponse(['option1'], {
        refresh: 512
      })

      jest.setSystemTime(Date.now() + 128)
      await hook.fetchOptions()

      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)
    })

    it('should use backoff instead of refresh after error', async () => {
      const refresh = 4096
      const { hook } = await setupHookWithResponse(['first success'], {
        refresh
      })

      mockAxiosError('Network error')
      jest.setSystemTime(Date.now() + refresh)
      await hook.fetchOptions()
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(2)

      mockAxiosResponse(['second success'])
      jest.setSystemTime(Date.now() + FIRST_BACKOFF)
      const thirdData = await hook.fetchOptions()
      expect(thirdData).toEqual(['second success'])
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(3)
    })

    it('should use last valid value after error', async () => {
      const refresh = 4096
      const { hook } = await setupHookWithResponse(['a valid value'], {
        refresh
      })

      mockAxiosError('Network error')
      jest.setSystemTime(Date.now() + refresh)
      const secondData = await hook.fetchOptions()

      expect(secondData).toEqual(['a valid value'])
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling and backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should implement exponential backoff on errors', async () => {
      mockAxiosError('Network error')

      const hook = useRemoteWidget(mockInputData)
      await hook.fetchOptions()
      const entry1 = hook.getCacheEntry()
      expect(entry1?.error).toBeTruthy()

      await hook.fetchOptions()
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)

      jest.setSystemTime(Date.now() + 500)
      await hook.fetchOptions()
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1) // Still backing off

      jest.setSystemTime(Date.now() + 3000)
      await hook.fetchOptions()
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(2)
      expect(entry1?.data).toBeDefined()
    })

    it('should reset error state on successful fetch', async () => {
      mockAxiosError('Network error')
      const hook = useRemoteWidget(mockInputData)
      const firstData = await hook.fetchOptions()
      expect(firstData).toBe('Loading...')

      jest.setSystemTime(Date.now() + 3000)
      mockAxiosResponse(['option1'])
      const secondData = await hook.fetchOptions()
      expect(secondData).toEqual(['option1'])

      const entry = hook.getCacheEntry()
      expect(entry?.error).toBeNull()
      expect(entry?.retryCount).toBe(0)
    })

    it('should save successful data after backoff', async () => {
      mockAxiosError('Network error')
      const hook = useRemoteWidget(mockInputData)
      await hook.fetchOptions()
      const entry1 = hook.getCacheEntry()
      expect(entry1?.error).toBeTruthy()

      jest.setSystemTime(Date.now() + 3000)
      mockAxiosResponse(['success after backoff'])
      const secondData = await hook.fetchOptions()
      expect(secondData).toEqual(['success after backoff'])

      const entry2 = hook.getCacheEntry()
      expect(entry2?.error).toBeNull()
      expect(entry2?.retryCount).toBe(0)
    })

    it('should save successful data after multiple backoffs', async () => {
      mockAxiosError('Network error')
      mockAxiosError('Network error')
      mockAxiosError('Network error')
      const hook = useRemoteWidget(mockInputData)
      await hook.fetchOptions()
      const entry1 = hook.getCacheEntry()
      expect(entry1?.error).toBeTruthy()

      jest.setSystemTime(Date.now() + 3000)
      const secondData = await hook.fetchOptions()
      expect(secondData).toBe('Loading...')
      expect(entry1?.error).toBeDefined()

      jest.setSystemTime(Date.now() + 9000)
      const thirdData = await hook.fetchOptions()
      expect(thirdData).toBe('Loading...')
      expect(entry1?.error).toBeDefined()

      jest.setSystemTime(Date.now() + 120_000)
      mockAxiosResponse(['success after multiple backoffs'])
      const fourthData = await hook.fetchOptions()
      expect(fourthData).toEqual(['success after multiple backoffs'])

      const entry2 = hook.getCacheEntry()
      expect(entry2?.error).toBeNull()
      expect(entry2?.retryCount).toBe(0)
    })
  })

  describe('cache management', () => {
    it('should clear cache entries', async () => {
      const { hook } = await setupHookWithResponse(['to be cleared'])
      expect(hook.getCacheEntry()).toBeDefined()

      hook.forceUpdate()
      expect(hook.getCacheEntry()).toBeUndefined()
    })

    it('should prevent duplicate in-flight requests', async () => {
      const promise = Promise.resolve({ data: ['non-duplicate'] })
      jest.mocked(axios.get).mockImplementationOnce(() => promise)

      const hook = useRemoteWidget(mockInputData)
      const [result1, result2] = await Promise.all([
        hook.fetchOptions(),
        hook.fetchOptions()
      ])

      expect(result1).toBe(result2)
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)
    })
  })

  describe('concurrent access and multiple instances', () => {
    it('should handle concurrent hook instances with same route', async () => {
      mockAxiosResponse(['shared data'])
      const hook1 = useRemoteWidget(mockInputData)
      const hook2 = useRemoteWidget(mockInputData)

      const [data1, data2] = await Promise.all([
        hook1.fetchOptions(),
        hook2.fetchOptions()
      ])

      expect(data1).toEqual(['shared data'])
      expect(data2).toEqual(['shared data'])
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)
      expect(hook1.getCacheEntry()).toBe(hook2.getCacheEntry())
    })

    it('should use shared cache across multiple hooks', async () => {
      mockAxiosResponse(['shared data'])
      const hook1 = useRemoteWidget(mockInputData)
      const hook2 = useRemoteWidget(mockInputData)
      const hook3 = useRemoteWidget(mockInputData)
      const hook4 = useRemoteWidget(mockInputData)

      const data1 = await hook1.fetchOptions()
      const data2 = await hook2.fetchOptions()
      const data3 = await hook3.fetchOptions()
      const data4 = await hook4.fetchOptions()

      expect(data1).toEqual(['shared data'])
      expect(data2).toBe(data1)
      expect(data3).toBe(data1)
      expect(data4).toBe(data1)
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)
      expect(hook1.getCacheEntry()).toBe(hook2.getCacheEntry())
      expect(hook2.getCacheEntry()).toBe(hook3.getCacheEntry())
      expect(hook3.getCacheEntry()).toBe(hook4.getCacheEntry())
    })

    it('should handle rapid cache clearing during fetch', async () => {
      let resolvePromise: (value: any) => void
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      jest.mocked(axios.get).mockImplementationOnce(() => delayedPromise)

      const hook = useRemoteWidget(mockInputData)
      const fetchPromise = hook.fetchOptions()
      hook.forceUpdate()

      resolvePromise!({ data: ['delayed data'] })
      const data = await fetchPromise

      expect(data).toEqual(['delayed data'])
      expect(hook.getCacheEntry()).toBeUndefined()
    })

    it('should handle widget destroyed during fetch', async () => {
      let resolvePromise: (value: any) => void
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      jest.mocked(axios.get).mockImplementationOnce(() => delayedPromise)

      let hook = useRemoteWidget(mockInputData)
      const fetchPromise = hook.fetchOptions()

      hook = null as any

      resolvePromise!({ data: ['delayed data'] })
      await fetchPromise

      expect(hook).toBeNull()
      hook = useRemoteWidget(mockInputData)

      const data2 = await hook.fetchOptions()
      expect(data2).toEqual(['delayed data'])
    })
  })
})
