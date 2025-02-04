import axios from 'axios'

import { useRemoteWidget } from '@/hooks/remoteWidgetHook'
import type { ComboInputSpec } from '@/types/apiTypes'

// Setup mocks before imports
jest.mock('axios', () => {
  return {
    get: jest.fn()
  }
})

// Mock Vue dependencies
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

// Mock widget store with required functions
jest.mock('@/stores/widgetStore', () => ({
  useWidgetStore: () => ({
    widgets: {},
    getDefaultValue: jest.fn().mockReturnValue('Loading...')
  })
}))

describe('useRemoteWidget', () => {
  let mockInputData: ComboInputSpec

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mocks
    jest.mocked(axios.get).mockReset()
    // Reset cache between tests
    jest.spyOn(Map.prototype, 'get').mockClear()
    jest.spyOn(Map.prototype, 'set').mockClear()
    jest.spyOn(Map.prototype, 'delete').mockClear()

    mockInputData = [
      'COMBO',
      {
        name: 'test_widget',
        type: 'remote',
        route: `/api/test/${Date.now()}`,
        refresh: 0
      }
    ]
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
      const hook1 = useRemoteWidget({
        ...mockInputData,
        1: { ...mockInputData[1], query_params: { a: 1 } }
      })
      const hook2 = useRemoteWidget({
        ...mockInputData,
        1: { ...mockInputData[1], query_params: { a: 2 } }
      })
      expect(hook1.getCacheKey()).not.toBe(hook2.getCacheKey())
    })
  })

  describe('fetchOptions', () => {
    it('should fetch data successfully', async () => {
      const mockData = ['optionA', 'optionB']
      jest.mocked(axios.get).mockResolvedValueOnce({ data: mockData })

      const hook = useRemoteWidget(mockInputData)
      const data = await hook.fetchOptions()

      expect(data).toEqual(mockData)
      expect(jest.mocked(axios.get)).toHaveBeenCalledWith(
        mockInputData[1].route,
        expect.any(Object)
      )
    })

    it('should use response_key if provided', async () => {
      const mockResponse = { items: ['optionB', 'optionA', 'optionC'] }
      jest.mocked(axios.get).mockResolvedValueOnce({ data: mockResponse })

      const inputWithKey = {
        ...mockInputData,
        1: { ...mockInputData[1], response_key: 'items' }
      }
      const hook = useRemoteWidget(inputWithKey)
      const data = await hook.fetchOptions()

      expect(data).toEqual(mockResponse.items)
    })

    it('should cache successful responses', async () => {
      const mockData = ['optionA', 'optionB', 'optionC', 'optionD']
      jest.mocked(axios.get).mockResolvedValueOnce({ data: mockData })

      const hook = useRemoteWidget(mockInputData)
      await hook.fetchOptions()
      const entry = hook.getCacheEntry()

      expect(entry?.data).toEqual(mockData)
      expect(entry?.error).toBeNull()
    })

    it('should handle fetch errors', async () => {
      const error = new Error('Network error')
      jest.mocked(axios.get).mockRejectedValueOnce(error)

      const hook = useRemoteWidget(mockInputData)
      const data = await hook.fetchOptions()
      expect(data).toBe('Loading...')

      const entry = hook.getCacheEntry()
      expect(entry?.error).toBeTruthy()
      expect(entry?.lastErrorTime).toBeDefined()
    })
  })

  describe('refresh behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should not refresh when refresh is 0', async () => {
      const mockData = ['option1']
      jest.mocked(axios.get).mockResolvedValueOnce({ data: mockData })

      const hook = useRemoteWidget(mockInputData)
      await hook.fetchOptions()
      await hook.fetchOptions() // Second call

      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)
    })

    it('should refresh when data is stale', async () => {
      const inputWithRefresh = {
        ...mockInputData,
        1: { ...mockInputData[1], refresh: 100 }
      }
      const mockData1 = ['option1']
      const mockData2 = ['option2']
      jest
        .mocked(axios.get)
        .mockResolvedValueOnce({ data: mockData1 })
        .mockResolvedValueOnce({ data: mockData2 })

      const hook = useRemoteWidget(inputWithRefresh)
      const initialData = await hook.fetchOptions()
      expect(initialData).toEqual(mockData1)

      // Advance time
      jest.setSystemTime(Date.now() + 200)

      const newData = await hook.fetchOptions()
      expect(newData).toEqual(mockData2)
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(2)
    })

    it('should not refresh when data is not stale', async () => {
      const inputWithRefresh = {
        ...mockInputData,
        1: { ...mockInputData[1], refresh: 512 }
      }
      const mockData = ['option1']
      jest.mocked(axios.get).mockResolvedValueOnce({ data: mockData })

      const hook = useRemoteWidget(inputWithRefresh)
      await hook.fetchOptions()
      await hook.fetchOptions() // Second call

      // Advance time but not enough to refresh
      jest.setSystemTime(Date.now() + 128)

      const newData = await hook.fetchOptions()
      expect(newData).toEqual(mockData)
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1)
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
      const error = new Error('Network error')
      jest.mocked(axios.get).mockRejectedValue(error)

      const hook = useRemoteWidget(mockInputData)
      await hook.fetchOptions()
      const entry1 = hook.getCacheEntry()
      expect(entry1?.error).toBeTruthy()

      // Try immediate retry
      await hook.fetchOptions()
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(1) // Should not retry immediately

      // Advance past backoff
      jest.setSystemTime(Date.now() + 120_000)
      await hook.fetchOptions()
      expect(jest.mocked(axios.get)).toHaveBeenCalledTimes(2) // Should retry after backoff
      expect(entry1?.data).toBeDefined()
    })

    it('should reset error state on successful fetch', async () => {
      jest
        .mocked(axios.get)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: ['option1'] })

      const hook = useRemoteWidget(mockInputData)
      const firstData = await hook.fetchOptions()
      expect(firstData).toBe('Loading...')

      // Advance past backoff
      jest.setSystemTime(Date.now() + 3000)
      const secondData = await hook.fetchOptions()
      expect(secondData).toEqual(['option1'])

      const entry = hook.getCacheEntry()
      expect(entry?.error).toBeNull()
      expect(entry?.retryCount).toBe(0)
    })

    it('should save successful data after backoff', async () => {
      jest.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'))
      jest
        .mocked(axios.get)
        .mockResolvedValueOnce({ data: ['success after backoff'] })

      const hook = useRemoteWidget(mockInputData)
      await hook.fetchOptions()
      const entry1 = hook.getCacheEntry()
      expect(entry1?.error).toBeTruthy()

      // Advance past backoff
      jest.setSystemTime(Date.now() + 3000)
      const secondData = await hook.fetchOptions()
      expect(secondData).toEqual(['success after backoff'])

      const entry2 = hook.getCacheEntry()
      expect(entry2?.error).toBeNull()
      expect(entry2?.retryCount).toBe(0)
    })

    it('should save successful data after multiple backoffs', async () => {
      jest.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'))
      jest.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'))
      jest.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'))
      jest
        .mocked(axios.get)
        .mockResolvedValueOnce({ data: ['success after multiple backoffs'] })

      const hook = useRemoteWidget(mockInputData)
      await hook.fetchOptions()
      const entry1 = hook.getCacheEntry()
      expect(entry1?.error).toBeTruthy()

      // Advance past first backoff
      jest.setSystemTime(Date.now() + 3000)
      const secondData = await hook.fetchOptions()
      expect(secondData).toBe('Loading...')
      expect(entry1?.error).toBeDefined()

      // Advance past second backoff
      jest.setSystemTime(Date.now() + 9000)
      const thirdData = await hook.fetchOptions()
      expect(thirdData).toBe('Loading...')
      expect(entry1?.error).toBeDefined()

      // Advance past third backoff
      jest.setSystemTime(Date.now() + 120_000)
      const fourthData = await hook.fetchOptions()
      expect(fourthData).toEqual(['success after multiple backoffs'])

      const entry2 = hook.getCacheEntry()
      expect(entry2?.error).toBeNull()
      expect(entry2?.retryCount).toBe(0)
    })
  })

  describe('cache management', () => {
    it('should clear cache entries', async () => {
      jest.mocked(axios.get).mockResolvedValueOnce({ data: ['option1'] })

      const hook = useRemoteWidget(mockInputData)
      await hook.fetchOptions()
      expect(hook.getCacheEntry()).toBeDefined()

      hook.clearCache()
      expect(hook.getCacheEntry()).toBeUndefined()
    })

    it('should prevent duplicate in-flight requests', async () => {
      const promise = Promise.resolve({ data: ['option1'] })
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
})
