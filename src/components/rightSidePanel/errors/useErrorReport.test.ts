import { until } from '@vueuse/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { toNodeId } from '@/types/nodeId'
import { createNodeExecutionId } from '@/types/nodeIdentification'

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
    generateErrorReport: vi.fn()
  }
})

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    getLogs: mocks.getLogs,
    getSystemStats: vi.fn(async () => sampleSystemStats)
  }
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    rootGraph: {
      serialize: mocks.serialize
    }
  }
}))

vi.mock(import('@/utils/errorReportUtil'), () => ({
  generateErrorReport: mocks.generateErrorReport
}))

const sampleSystemStats = {
  system: {
    os: 'Linux',
    comfyui_version: '1.0.0',
    argv: [],
    python_version: '3.11',
    embedded_python: false,
    pytorch_version: '2.3.0',
    ram_total: 16000000000,
    ram_free: 8000000000
  },
  devices: []
}

function makeCard(overrides: Partial<ErrorCardData> = {}): ErrorCardData {
  return {
    id: 'card-1',
    title: 'KSampler',
    nodeId: createNodeExecutionId([toNodeId(42)]),
    errors: [],
    ...overrides
  }
}

describe('useErrorReport', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    const store = useSystemStatsStore()
    await until(() => store.isInitialized).toBe(true)
    store.systemStats = null
    store.isLoading = false
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
    const store = useSystemStatsStore()
    store.systemStats = sampleSystemStats
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
      nodeId: createNodeExecutionId([toNodeId(42)]),
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
    const store = useSystemStatsStore()
    store.isLoading = true
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

    store.systemStats = sampleSystemStats
    store.isLoading = false
    await flushPromises()

    expect(mocks.getLogs).toHaveBeenCalledTimes(1)
    expect(displayedDetailsMap.value).toEqual({ 0: 'report' })
  })

  it('calls refetchSystemStats when not loading and stats are missing', async () => {
    const store = useSystemStatsStore()
    vi.mocked(useSystemStatsStore().refetchSystemStats).mockImplementation(
      async () => {
        store.systemStats = sampleSystemStats
        return sampleSystemStats
      }
    )
    mocks.getLogs.mockResolvedValue('logs')
    mocks.serialize.mockReturnValue({ nodes: [] })
    mocks.generateErrorReport.mockReturnValue('report')

    const card = makeCard({
      errors: [{ message: 'runtime', details: 'trace', isRuntimeError: true }]
    })

    useErrorReport(card)
    await flushPromises()

    expect(
      vi.mocked(useSystemStatsStore().refetchSystemStats)
    ).toHaveBeenCalledTimes(1)
    expect(mocks.generateErrorReport).toHaveBeenCalledTimes(1)
  })

  it('returns early and warns when refetchSystemStats throws', async () => {
    vi.mocked(useSystemStatsStore().refetchSystemStats).mockRejectedValue(
      new Error('boom')
    )
    mocks.getLogs.mockResolvedValue('logs')

    const card = makeCard({
      errors: [{ message: 'runtime', details: 'trace', isRuntimeError: true }]
    })

    useErrorReport(card)
    await flushPromises()

    expect(
      vi.mocked(useSystemStatsStore().refetchSystemStats)
    ).toHaveBeenCalledTimes(1)
    expect(mocks.getLogs).not.toHaveBeenCalled()
    expect(mocks.generateErrorReport).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns early and warns when workflow serialization throws', async () => {
    const store = useSystemStatsStore()
    store.systemStats = sampleSystemStats
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
    const store = useSystemStatsStore()
    store.systemStats = sampleSystemStats
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
    const store = useSystemStatsStore()
    store.systemStats = sampleSystemStats
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
    const store = useSystemStatsStore()
    store.systemStats = sampleSystemStats
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
