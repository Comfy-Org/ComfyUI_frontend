import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { useSystemStatsStore } from '@/stores/systemStatsStore'

import type { ErrorCardData } from './types'
import { useErrorReport } from './useErrorReport'

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

const mocks = vi.hoisted(() => {
  // Helpers only — imports happen inside factories below.
  return {
    getLogs: vi.fn(),
    serialize: vi.fn(),
    refetchSystemStats: vi.fn(),
    generateErrorReport: vi.fn()
  }
})

const storeState = vi.hoisted(() => {
  // Plain objects wired up in beforeEach. Tests use setStoreState to swap values.
  return {
    systemStats: null as unknown,
    isLoading: false
  }
})

vi.mock('@/scripts/api', () => ({
  api: {
    getLogs: mocks.getLogs
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      serialize: mocks.serialize
    }
  }
}))

vi.mock('@/utils/errorReportUtil', () => ({
  generateErrorReport: mocks.generateErrorReport
}))

vi.mock('@/stores/systemStatsStore', async () => {
  const { ref: vueRef } = await import('vue')
  const systemStatsRef = vueRef<unknown>(null)
  const isLoadingRef = vueRef(false)

  return {
    useSystemStatsStore: () => ({
      get systemStats() {
        return systemStatsRef.value
      },
      set systemStats(value: unknown) {
        systemStatsRef.value = value
      },
      get isLoading() {
        return isLoadingRef.value
      },
      set isLoading(value: boolean) {
        isLoadingRef.value = value
      },
      refetchSystemStats: mocks.refetchSystemStats,
      __setSystemStats(value: unknown) {
        systemStatsRef.value = value
      },
      __setIsLoading(value: boolean) {
        isLoadingRef.value = value
      }
    })
  }
})

type TestStore = ReturnType<typeof useSystemStatsStore> & {
  __setSystemStats: (value: unknown) => void
  __setIsLoading: (value: boolean) => void
}

async function getStore(): Promise<TestStore> {
  const mod = await import('@/stores/systemStatsStore')
  return mod.useSystemStatsStore() as unknown as TestStore
}

const sampleSystemStats = {
  system: {
    os: 'Linux',
    comfyui_version: '1.0.0',
    argv: [],
    python_version: '3.11',
    embedded_python: false,
    pytorch_version: '2.3.0'
  },
  devices: []
}

function makeCard(overrides: Partial<ErrorCardData> = {}): ErrorCardData {
  return {
    id: 'card-1',
    title: 'KSampler',
    nodeId: '42',
    errors: [],
    ...overrides
  }
}

describe('useErrorReport', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    mocks.getLogs.mockReset()
    mocks.serialize.mockReset()
    mocks.refetchSystemStats.mockReset()
    mocks.generateErrorReport.mockReset()
    storeState.systemStats = null
    storeState.isLoading = false
    const store = await getStore()
    store.__setSystemStats(null)
    store.__setIsLoading(false)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('returns early without enrichment when the card has no runtime errors', async () => {
    const card = makeCard({
      errors: [{ message: 'static', details: 'details' }]
    })

    const { displayedDetailsMap } = useErrorReport(card)
    await flushPromises()

    expect(mocks.getLogs).not.toHaveBeenCalled()
    expect(mocks.generateErrorReport).not.toHaveBeenCalled()
    expect(displayedDetailsMap.value).toEqual({ 0: 'details' })
  })

  it('enriches each runtime error with a generated report when systemStats is present', async () => {
    const store = await getStore()
    store.__setSystemStats(sampleSystemStats)
    mocks.getLogs.mockResolvedValue('server logs')
    mocks.serialize.mockReturnValue({ nodes: [] })
    mocks.generateErrorReport.mockImplementation(
      ({ exceptionType }: { exceptionType: string }) =>
        `report:${exceptionType}`
    )

    const card = makeCard({
      errors: [
        {
          message: 'CUDA oom',
          details: 'trace-0',
          isRuntimeError: true,
          exceptionType: 'RuntimeError'
        },
        {
          message: 'static',
          details: 'skip-me'
        },
        {
          message: 'Other runtime error',
          details: 'trace-2',
          isRuntimeError: true
        }
      ]
    })

    const { displayedDetailsMap } = useErrorReport(card)
    await flushPromises()

    expect(mocks.getLogs).toHaveBeenCalledTimes(1)
    expect(mocks.generateErrorReport).toHaveBeenCalledTimes(2)
    expect(mocks.generateErrorReport).toHaveBeenNthCalledWith(1, {
      exceptionType: 'RuntimeError',
      exceptionMessage: 'CUDA oom',
      traceback: 'trace-0',
      nodeId: '42',
      nodeType: 'KSampler',
      systemStats: sampleSystemStats,
      serverLogs: 'server logs',
      workflow: { nodes: [] }
    })
    expect(mocks.generateErrorReport).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        exceptionType: 'Runtime Error',
        exceptionMessage: 'Other runtime error',
        traceback: 'trace-2'
      })
    )

    expect(displayedDetailsMap.value).toEqual({
      0: 'report:RuntimeError',
      1: 'skip-me',
      2: 'report:Runtime Error'
    })
  })

  it('awaits the systemStats loading flag before proceeding', async () => {
    const store = await getStore()
    store.__setIsLoading(true)
    mocks.getLogs.mockResolvedValue('logs')
    mocks.serialize.mockReturnValue({ nodes: [] })
    mocks.generateErrorReport.mockReturnValue('report')

    const card = makeCard({
      errors: [{ message: 'runtime', details: 'trace', isRuntimeError: true }]
    })

    const { displayedDetailsMap } = useErrorReport(card)
    await flushPromises()

    expect(mocks.getLogs).not.toHaveBeenCalled()
    expect(displayedDetailsMap.value).toEqual({ 0: 'trace' })

    store.__setSystemStats(sampleSystemStats)
    store.__setIsLoading(false)
    await flushPromises()

    expect(mocks.getLogs).toHaveBeenCalledTimes(1)
    expect(displayedDetailsMap.value).toEqual({ 0: 'report' })
  })

  it('calls refetchSystemStats when not loading and stats are missing', async () => {
    const store = await getStore()
    mocks.refetchSystemStats.mockImplementation(async () => {
      store.__setSystemStats(sampleSystemStats)
    })
    mocks.getLogs.mockResolvedValue('logs')
    mocks.serialize.mockReturnValue({ nodes: [] })
    mocks.generateErrorReport.mockReturnValue('report')

    const card = makeCard({
      errors: [{ message: 'runtime', details: 'trace', isRuntimeError: true }]
    })

    useErrorReport(card)
    await flushPromises()

    expect(mocks.refetchSystemStats).toHaveBeenCalledTimes(1)
    expect(mocks.generateErrorReport).toHaveBeenCalledTimes(1)
  })

  it('returns early and warns when refetchSystemStats throws', async () => {
    mocks.refetchSystemStats.mockRejectedValue(new Error('boom'))
    mocks.getLogs.mockResolvedValue('logs')

    const card = makeCard({
      errors: [{ message: 'runtime', details: 'trace', isRuntimeError: true }]
    })

    useErrorReport(card)
    await flushPromises()

    expect(mocks.refetchSystemStats).toHaveBeenCalledTimes(1)
    expect(mocks.getLogs).not.toHaveBeenCalled()
    expect(mocks.generateErrorReport).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns early and warns when workflow serialization throws', async () => {
    const store = await getStore()
    store.__setSystemStats(sampleSystemStats)
    mocks.getLogs.mockResolvedValue('logs')
    mocks.serialize.mockImplementation(() => {
      throw new Error('serialize failed')
    })

    const card = makeCard({
      errors: [{ message: 'runtime', details: 'trace', isRuntimeError: true }]
    })

    const { displayedDetailsMap } = useErrorReport(card)
    await flushPromises()

    expect(mocks.generateErrorReport).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    expect(displayedDetailsMap.value).toEqual({ 0: 'trace' })
  })

  it('falls back to original error.details when generateErrorReport throws', async () => {
    const store = await getStore()
    store.__setSystemStats(sampleSystemStats)
    mocks.getLogs.mockResolvedValue('logs')
    mocks.serialize.mockReturnValue({ nodes: [] })
    mocks.generateErrorReport.mockImplementation(() => {
      throw new Error('generate failed')
    })

    const card = makeCard({
      errors: [
        { message: 'runtime', details: 'fallback', isRuntimeError: true }
      ]
    })

    const { displayedDetailsMap } = useErrorReport(card)
    await flushPromises()

    expect(warnSpy).toHaveBeenCalled()
    expect(displayedDetailsMap.value).toEqual({ 0: 'fallback' })
  })

  it('re-enriches and clears stale enriched details when the card ref changes', async () => {
    const store = await getStore()
    store.__setSystemStats(sampleSystemStats)
    mocks.getLogs.mockResolvedValue('logs')
    mocks.serialize.mockReturnValue({ nodes: [] })
    mocks.generateErrorReport.mockImplementation(
      ({ exceptionMessage }: { exceptionMessage: string }) =>
        `report:${exceptionMessage}`
    )

    const cardRef = ref<ErrorCardData>(
      makeCard({
        id: 'first',
        errors: [
          { message: 'first-err', details: 'first', isRuntimeError: true }
        ]
      })
    )

    const { displayedDetailsMap } = useErrorReport(cardRef)
    await flushPromises()

    expect(displayedDetailsMap.value).toEqual({ 0: 'report:first-err' })

    cardRef.value = makeCard({
      id: 'second',
      errors: [{ message: 'plain', details: 'plain-details' }]
    })
    await nextTick()
    await flushPromises()

    expect(displayedDetailsMap.value).toEqual({ 0: 'plain-details' })
  })

  it('drops stale results when the card changes mid-flight', async () => {
    const store = await getStore()
    store.__setSystemStats(sampleSystemStats)
    mocks.serialize.mockReturnValue({ nodes: [] })
    mocks.generateErrorReport.mockImplementation(
      ({ exceptionMessage }: { exceptionMessage: string }) =>
        `report:${exceptionMessage}`
    )

    const firstLogsDeferred: {
      resolve: (value: string) => void
      promise: Promise<string>
    } = (() => {
      let resolve: (value: string) => void = () => {}
      const promise = new Promise<string>((r) => {
        resolve = r
      })
      return { resolve, promise }
    })()
    mocks.getLogs.mockImplementationOnce(() => firstLogsDeferred.promise)
    mocks.getLogs.mockImplementationOnce(async () => 'second-logs')

    const cardRef = ref<ErrorCardData>(
      makeCard({
        id: 'first',
        errors: [
          { message: 'first-err', details: 'first', isRuntimeError: true }
        ]
      })
    )

    const { displayedDetailsMap } = useErrorReport(cardRef)
    await flushPromises()

    cardRef.value = makeCard({
      id: 'second',
      errors: [
        { message: 'second-err', details: 'second', isRuntimeError: true }
      ]
    })
    await nextTick()
    await flushPromises()

    firstLogsDeferred.resolve('stale-logs')
    await flushPromises()

    expect(displayedDetailsMap.value).toEqual({ 0: 'report:second-err' })
  })
})
