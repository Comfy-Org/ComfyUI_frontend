import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useRemoteWidget } from '@/composables/widgets/useRemoteWidget'
import { RemoteWidgetConfig } from '@/schemas/nodeDefSchema'

vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn()
    }
  }
})

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      t: vi.fn((key) => key)
    }
  }
}))

vi.mock('@/stores/settingStore', () => ({
  useSettingStore: () => ({
    settings: {}
  })
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

vi.mock('@/composables/functional/useChainCallback', () => ({
  useChainCallback: vi.fn((original, ...callbacks) => {
    return function (this: any, ...args: any[]) {
      original?.apply(this, args)
      callbacks.forEach((cb: any) => cb.apply(this, args))
    }
  })
}))

const FIRST_BACKOFF = 1000 // backoff is 1s on first retry
const DEFAULT_VALUE = 'Loading...'

function createMockConfig(overrides = {}): RemoteWidgetConfig {
  return {
    route: `/api/test/${Date.now()}${Math.random().toString(36).substring(2, 15)}`,
    refresh: 0,
    ...overrides
  }
}

const createMockOptions = (inputOverrides = {}) => ({
  remoteConfig: createMockConfig(inputOverrides),
  defaultValue: DEFAULT_VALUE,
  node: {
    addWidget: vi.fn()
  } as any,
  widget: {} as any
})

function mockAxiosResponse(data: unknown, status = 200) {
  vi.mocked(axios.get).mockResolvedValueOnce({ data, status })
}

function mockAxiosError(error: Error | string) {
  const err = error instanceof Error ? error : new Error(error)
  vi.mocked(axios.get).mockRejectedValueOnce(err)
}

function createHookWithData(data: unknown, inputOverrides = {}) {
  mockAxiosResponse(data)
  const hook = useRemoteWidget(createMockOptions(inputOverrides))
  return hook
}

async function setupHookWithResponse(data: unknown, inputOverrides = {}) {
  const hook = createHookWithData(data, inputOverrides)
  const result = await getResolvedValue(hook)
  return { hook, result }
}

async function getResolvedValue(hook: ReturnType<typeof useRemoteWidget>) {
  // Create a promise that resolves when the fetch is complete
  const responsePromise = new Promise<void>((resolve) => {
    hook.getValue(() => resolve())
  })
  await responsePromise
  return hook.getCachedValue()
}

describe('useRemoteWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mocks
    vi.mocked(axios.get).mockReset()
    // Reset cache between tests
    vi.spyOn(Map.prototype, 'get').mockClear()
    vi.spyOn(Map.prototype, 'set').mockClear()
    vi.spyOn(Map.prototype, 'delete').mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should create hook with default values', () => {
      const hook = useRemoteWidget(createMockOptions())
      expect(hook.getCachedValue()).toBeUndefined()
      expect(hook.getValue()).toBe('Loading...')
    })

    it('should generate consistent cache keys', () => {
      const options = createMockOptions()
      const hook1 = useRemoteWidget(options)
      const hook2 = useRemoteWidget(options)
      expect(hook1.cacheKey).toBe(hook2.cacheKey)
    })

    it('should handle query params in cache key', () => {
      const hook1 = useRemoteWidget(
        createMockOptions({ query_params: { a: 1 } })
      )
      const hook2 = useRemoteWidget(
        createMockOptions({ query_params: { a: 2 } })
      )
      expect(hook1.cacheKey).not.toBe(hook2.cacheKey)
    })
  })

  describe('fetchOptions', () => {
    it('should fetch data successfully', async () => {
      const mockData = ['optionA', 'optionB']
      const { hook, result } = await setupHookWithResponse(mockData)
      expect(result).toEqual(mockData)
      expect(vi.mocked(axios.get)).toHaveBeenCalledWith(
        hook.cacheKey.split(';')[0], // Get the route part from cache key
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

      const { hook } = await setupHookWithResponse([])

      const entry = hook.getCacheEntry()
      expect(entry?.error).toBeTruthy()
      expect(entry?.lastErrorTime).toBeDefined()
    })

    it('should handle empty array responses', async () => {
      const { result } = await setupHookWithResponse([])
      expect(result).toEqual([])
    })

    it('should handle malformed response data', async () => {
      const hook = useRemoteWidget(createMockOptions())

      mockAxiosResponse(null)
      const data1 = hook.getValue()

      mockAxiosResponse(undefined)
      const data2 = hook.getValue()

      expect(data1).toBe(DEFAULT_VALUE)
      expect(data2).toBe(DEFAULT_VALUE)
    })

    it('should handle non-200 status codes', async () => {
      mockAxiosError('Request failed with status code 404')

      const { hook } = await setupHookWithResponse([])
      const entry = hook.getCacheEntry()
      expect(entry?.error?.message).toBe('Request failed with status code 404')
    })
  })

  describe('refresh behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.clearAllMocks()
    })

    describe('permanent widgets (no refresh)', () => {
      it('permanent widgets should not attempt fetch after initialization', async () => {
        const mockData = ['data that is permanent after initialization']
        const { hook } = await setupHookWithResponse(mockData)

        await getResolvedValue(hook)
        await getResolvedValue(hook)

        expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)
      })

      it('permanent widgets should re-fetch if refreshValue is called', async () => {
        const mockData = ['data that is permanent after initialization']
        const { hook } = await setupHookWithResponse(mockData)

        await getResolvedValue(hook)
        const refreshedData = ['data that user forced to be fetched']
        mockAxiosResponse(refreshedData)

        hook.refreshValue()
        const data = await getResolvedValue(hook)
        expect(data).toEqual(refreshedData)
      })

      it('permanent widgets should still retry if request fails', async () => {
        mockAxiosError('Network error')

        const hook = useRemoteWidget(createMockOptions())
        await getResolvedValue(hook)
        expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)

        vi.setSystemTime(Date.now() + FIRST_BACKOFF)
        const secondData = await getResolvedValue(hook)
        expect(secondData).toBe('Loading...')
        expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2)
      })

      it('should treat empty refresh field as permanent', async () => {
        const { hook } = await setupHookWithResponse(['data that is permanent'])

        await getResolvedValue(hook)
        await getResolvedValue(hook)

        expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)
      })
    })

    it('should refresh when data is stale', async () => {
      const refresh = 256
      const mockData1 = ['option1']
      const mockData2 = ['option2']

      const { hook } = await setupHookWithResponse(mockData1, { refresh })
      mockAxiosResponse(mockData2)

      vi.setSystemTime(Date.now() + refresh)
      const newData = await getResolvedValue(hook)

      expect(newData).toEqual(mockData2)
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2)
    })

    it('should not refresh when data is not stale', async () => {
      const { hook } = await setupHookWithResponse(['option1'], {
        refresh: 512
      })

      vi.setSystemTime(Date.now() + 128)
      await getResolvedValue(hook)

      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)
    })

    it('should use backoff instead of refresh after error', async () => {
      const refresh = 4096
      const { hook } = await setupHookWithResponse(['first success'], {
        refresh
      })

      mockAxiosError('Network error')
      vi.setSystemTime(Date.now() + refresh)
      await getResolvedValue(hook)
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2)

      mockAxiosResponse(['second success'])
      vi.setSystemTime(Date.now() + FIRST_BACKOFF)
      const thirdData = await getResolvedValue(hook)
      expect(thirdData).toEqual(['second success'])
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(3)
    })

    it('should use last valid value after error', async () => {
      const refresh = 4096
      const { hook } = await setupHookWithResponse(['a valid value'], {
        refresh
      })

      mockAxiosError('Network error')
      vi.setSystemTime(Date.now() + refresh)
      const secondData = await getResolvedValue(hook)

      expect(secondData).toEqual(['a valid value'])
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling and backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should implement exponential backoff on errors', async () => {
      mockAxiosError('Network error')

      const hook = useRemoteWidget(createMockOptions())
      await getResolvedValue(hook)
      const entry1 = hook.getCacheEntry()
      expect(entry1?.error).toBeTruthy()

      await getResolvedValue(hook)
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)

      vi.setSystemTime(Date.now() + 500)
      await getResolvedValue(hook)
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1) // Still backing off

      vi.setSystemTime(Date.now() + 3000)
      await getResolvedValue(hook)
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(2)
      expect(entry1?.data).toBeDefined()
    })

    it('should reset error state on successful fetch', async () => {
      mockAxiosError('Network error')
      const hook = useRemoteWidget(createMockOptions())
      const firstData = await getResolvedValue(hook)
      expect(firstData).toBe('Loading...')

      vi.setSystemTime(Date.now() + 3000)
      mockAxiosResponse(['option1'])
      const secondData = await getResolvedValue(hook)
      expect(secondData).toEqual(['option1'])

      const entry = hook.getCacheEntry()
      expect(entry?.error).toBeNull()
      expect(entry?.retryCount).toBe(0)
    })

    it('should save successful data after backoff', async () => {
      mockAxiosError('Network error')
      const hook = useRemoteWidget(createMockOptions())
      await getResolvedValue(hook)
      const entry1 = hook.getCacheEntry()
      expect(entry1?.error).toBeTruthy()

      vi.setSystemTime(Date.now() + 3000)
      mockAxiosResponse(['success after backoff'])
      const secondData = await getResolvedValue(hook)
      expect(secondData).toEqual(['success after backoff'])

      const entry2 = hook.getCacheEntry()
      expect(entry2?.error).toBeNull()
      expect(entry2?.retryCount).toBe(0)
    })

    it('should save successful data after multiple backoffs', async () => {
      mockAxiosError('Network error')
      mockAxiosError('Network error')
      mockAxiosError('Network error')
      const hook = useRemoteWidget(createMockOptions())
      await getResolvedValue(hook)
      const entry1 = hook.getCacheEntry()
      expect(entry1?.error).toBeTruthy()

      vi.setSystemTime(Date.now() + 3000)
      const secondData = await getResolvedValue(hook)
      expect(secondData).toBe('Loading...')
      expect(entry1?.error).toBeDefined()

      vi.setSystemTime(Date.now() + 9000)
      const thirdData = await getResolvedValue(hook)
      expect(thirdData).toBe('Loading...')
      expect(entry1?.error).toBeDefined()

      vi.setSystemTime(Date.now() + 120_000)
      mockAxiosResponse(['success after multiple backoffs'])
      const fourthData = await getResolvedValue(hook)
      expect(fourthData).toEqual(['success after multiple backoffs'])

      const entry2 = hook.getCacheEntry()
      expect(entry2?.error).toBeNull()
      expect(entry2?.retryCount).toBe(0)
    })
  })

  describe('cache management', () => {
    it('should clear cache entries', async () => {
      const { hook } = await setupHookWithResponse(['to be cleared'])
      expect(hook.getCachedValue()).toBeDefined()

      hook.refreshValue()
      expect(hook.getCachedValue()).toBe(DEFAULT_VALUE)
    })

    it('should prevent duplicate in-flight requests', async () => {
      const promise = Promise.resolve({ data: ['non-duplicate'] })
      vi.mocked(axios.get).mockImplementationOnce(() => promise as any)

      const hook = useRemoteWidget(createMockOptions())
      const [result1, result2] = await Promise.all([
        getResolvedValue(hook),
        getResolvedValue(hook)
      ])

      expect(result1).toBe(result2)
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)
    })
  })

  describe('concurrent access and multiple instances', () => {
    it('should handle concurrent hook instances with same route', async () => {
      mockAxiosResponse(['shared data'])
      const options = createMockOptions()
      const hook1 = useRemoteWidget(options)
      const hook2 = useRemoteWidget(options)

      // Since they have the same route, only one request will be made
      await Promise.race([getResolvedValue(hook1), getResolvedValue(hook2)])

      const data1 = hook1.getValue()
      const data2 = hook2.getValue()

      expect(data1).toEqual(['shared data'])
      expect(data2).toEqual(['shared data'])
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)
      expect(hook1.getCachedValue()).toBe(hook2.getCachedValue())
    })

    it('should use shared cache across multiple hooks', async () => {
      mockAxiosResponse(['shared data'])
      const options = createMockOptions()
      const hook1 = useRemoteWidget(options)
      const hook2 = useRemoteWidget(options)
      const hook3 = useRemoteWidget(options)
      const hook4 = useRemoteWidget(options)

      const data1 = await getResolvedValue(hook1)
      const data2 = await getResolvedValue(hook2)
      const data3 = await getResolvedValue(hook3)
      const data4 = await getResolvedValue(hook4)

      expect(data1).toEqual(['shared data'])
      expect(data2).toBe(data1)
      expect(data3).toBe(data1)
      expect(data4).toBe(data1)
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1)
      expect(hook1.getCachedValue()).toBe(hook2.getCachedValue())
      expect(hook2.getCachedValue()).toBe(hook3.getCachedValue())
      expect(hook3.getCachedValue()).toBe(hook4.getCachedValue())
    })

    it('should handle rapid cache clearing during fetch', async () => {
      let resolvePromise: (value: any) => void
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(axios.get).mockImplementationOnce(() => delayedPromise as any)

      const hook = useRemoteWidget(createMockOptions())
      hook.getValue()
      hook.refreshValue()

      resolvePromise!({ data: ['delayed data'] })
      const data = await getResolvedValue(hook)

      // The value should be the default value because the refreshValue
      // clears the cache and the fetch is aborted
      expect(data).toEqual(DEFAULT_VALUE)
      expect(hook.getCachedValue()).toBe(DEFAULT_VALUE)
    })

    it('should handle widget destroyed during fetch', async () => {
      let resolvePromise: (value: any) => void
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(axios.get).mockImplementationOnce(() => delayedPromise as any)

      let hook = useRemoteWidget(createMockOptions())
      const fetchPromise = hook.getValue()

      hook = null as any

      resolvePromise!({ data: ['delayed data'] })
      await fetchPromise

      expect(hook).toBeNull()
      hook = useRemoteWidget(createMockOptions())

      const data2 = await getResolvedValue(hook)
      expect(data2).toEqual(DEFAULT_VALUE)
    })
  })

  describe('auto-refresh on task completion', () => {
    it('should add auto-refresh toggle widget', () => {
      const mockNode = {
        addWidget: vi.fn(),
        widgets: []
      }
      const mockWidget = {
        refresh: vi.fn()
      }

      useRemoteWidget({
        remoteConfig: createMockConfig(),
        defaultValue: DEFAULT_VALUE,
        node: mockNode as any,
        widget: mockWidget as any
      })

      // Should add auto-refresh toggle widget
      expect(mockNode.addWidget).toHaveBeenCalledWith(
        'toggle',
        'Auto-refresh after generation',
        false,
        expect.any(Function),
        {
          serialize: false
        }
      )
    })

    it('should register event listener when enabled', async () => {
      const { api } = await import('@/scripts/api')

      const mockNode = {
        addWidget: vi.fn(),
        widgets: []
      }
      const mockWidget = {
        refresh: vi.fn()
      }

      useRemoteWidget({
        remoteConfig: createMockConfig(),
        defaultValue: DEFAULT_VALUE,
        node: mockNode as any,
        widget: mockWidget as any
      })

      // Event listener should be registered immediately
      expect(api.addEventListener).toHaveBeenCalledWith(
        'execution_success',
        expect.any(Function)
      )
    })

    it('should refresh widget when workflow completes successfully', async () => {
      const { api } = await import('@/scripts/api')
      let executionSuccessHandler: (() => void) | undefined

      // Capture the event handler
      vi.mocked(api.addEventListener).mockImplementation((event, handler) => {
        if (event === 'execution_success') {
          executionSuccessHandler = handler as () => void
        }
      })

      const mockNode = {
        addWidget: vi.fn(),
        widgets: []
      }
      const mockWidget = {} as any

      useRemoteWidget({
        remoteConfig: createMockConfig(),
        defaultValue: DEFAULT_VALUE,
        node: mockNode as any,
        widget: mockWidget
      })

      // Spy on the refresh function that was added by useRemoteWidget
      const refreshSpy = vi.spyOn(mockWidget, 'refresh')

      // Get the toggle callback and enable auto-refresh
      const toggleCallback = mockNode.addWidget.mock.calls.find(
        (call) => call[0] === 'toggle'
      )?.[3]
      toggleCallback?.(true)

      // Simulate workflow completion
      executionSuccessHandler?.()

      expect(refreshSpy).toHaveBeenCalled()
    })

    it('should not refresh when toggle is disabled', async () => {
      const { api } = await import('@/scripts/api')
      let executionSuccessHandler: (() => void) | undefined

      // Capture the event handler
      vi.mocked(api.addEventListener).mockImplementation((event, handler) => {
        if (event === 'execution_success') {
          executionSuccessHandler = handler as () => void
        }
      })

      const mockNode = {
        addWidget: vi.fn(),
        widgets: []
      }
      const mockWidget = {} as any

      useRemoteWidget({
        remoteConfig: createMockConfig(),
        defaultValue: DEFAULT_VALUE,
        node: mockNode as any,
        widget: mockWidget
      })

      // Spy on the refresh function that was added by useRemoteWidget
      const refreshSpy = vi.spyOn(mockWidget, 'refresh')

      // Toggle is disabled by default
      // Simulate workflow completion
      executionSuccessHandler?.()

      expect(refreshSpy).not.toHaveBeenCalled()
    })

    it('should cleanup event listener on node removal', async () => {
      const { api } = await import('@/scripts/api')
      let executionSuccessHandler: (() => void) | undefined

      // Capture the event handler
      vi.mocked(api.addEventListener).mockImplementation((event, handler) => {
        if (event === 'execution_success') {
          executionSuccessHandler = handler as () => void
        }
      })

      const mockNode = {
        addWidget: vi.fn(),
        widgets: [],
        onRemoved: undefined as any
      }
      const mockWidget = {
        refresh: vi.fn()
      }

      useRemoteWidget({
        remoteConfig: createMockConfig(),
        defaultValue: DEFAULT_VALUE,
        node: mockNode as any,
        widget: mockWidget as any
      })

      // Simulate node removal
      mockNode.onRemoved?.()

      expect(api.removeEventListener).toHaveBeenCalledWith(
        'execution_success',
        executionSuccessHandler
      )
    })
  })
})
