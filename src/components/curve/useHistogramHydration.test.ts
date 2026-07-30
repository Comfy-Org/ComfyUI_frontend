import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeLocatorId } from '@/types/nodeIdentification'

const mockGetHistory = vi.fn()
vi.mock('@/scripts/api', () => ({
  api: {
    getHistory: (...args: unknown[]) => mockGetHistory(...args)
  }
}))

const mockGetJobDetail = vi.fn()
vi.mock('@/services/jobOutputCache', () => ({
  getJobDetail: (...args: unknown[]) => mockGetJobDetail(...args)
}))

vi.mock('@/scripts/app', () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => ''),
    rootGraph: {},
    nodeOutputs: {} as Record<string, unknown>,
    nodePreviewImages: {} as Record<string, string[]>
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  executionIdToNodeLocatorId: vi.fn(
    (_rootGraph: unknown, id: string) => id as NodeLocatorId
  )
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => ({
    nodeIdToNodeLocatorId: vi.fn((id: string | number) => String(id)),
    nodeToNodeLocatorId: vi.fn((node: { id: number }) => String(node.id))
  }))
}))

import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

import { hydrateHistogramFromHistory } from './useHistogramHydration'

function locator(id: string): NodeLocatorId {
  return id as NodeLocatorId
}

describe('hydrateHistogramFromHistory', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('restores the histogram from the most recent history job', async () => {
    mockGetHistory.mockResolvedValue([{ id: 'job-1' }])
    mockGetJobDetail.mockResolvedValue({
      outputs: { '5': { histogram: [1, 2, 3] } }
    })

    const store = useNodeOutputStore()
    await hydrateHistogramFromHistory(locator('5'))

    expect(mockGetJobDetail).toHaveBeenCalledWith('job-1')
    expect(store.nodeOutputs['5']?.histogram).toEqual([1, 2, 3])
  })

  it('does not hit the network when a histogram is already present', async () => {
    const store = useNodeOutputStore()
    store.nodeOutputs['5'] = { histogram: [9, 9] }

    await hydrateHistogramFromHistory(locator('5'))

    expect(mockGetHistory).not.toHaveBeenCalled()
    expect(store.nodeOutputs['5']?.histogram).toEqual([9, 9])
  })

  it('is a no-op for a brand new node with no history at all', async () => {
    mockGetHistory.mockResolvedValue([])

    const store = useNodeOutputStore()
    await hydrateHistogramFromHistory(locator('5'))

    expect(mockGetJobDetail).not.toHaveBeenCalled()
    expect(store.nodeOutputs['5']).toBeUndefined()
  })

  it('is a no-op when the latest job has no entry for this node', async () => {
    mockGetHistory.mockResolvedValue([{ id: 'job-1' }])
    mockGetJobDetail.mockResolvedValue({
      outputs: { '7': { histogram: [1, 2, 3] } }
    })

    const store = useNodeOutputStore()
    await hydrateHistogramFromHistory(locator('5'))

    expect(store.nodeOutputs['5']).toBeUndefined()
  })

  it('is a no-op when the matched entry has no histogram data', async () => {
    mockGetHistory.mockResolvedValue([{ id: 'job-1' }])
    mockGetJobDetail.mockResolvedValue({
      outputs: { '5': { images: [{ filename: 'a.png' }] } }
    })

    const store = useNodeOutputStore()
    await hydrateHistogramFromHistory(locator('5'))

    expect(store.nodeOutputs['5']).toBeUndefined()
  })

  it('tolerates the job detail request failing', async () => {
    mockGetHistory.mockResolvedValue([{ id: 'job-1' }])
    mockGetJobDetail.mockResolvedValue(undefined)

    const store = useNodeOutputStore()
    await expect(
      hydrateHistogramFromHistory(locator('5'))
    ).resolves.toBeUndefined()
    expect(store.nodeOutputs['5']).toBeUndefined()
  })

  it('hydrates multiple curve widgets independently from the same job', async () => {
    mockGetHistory.mockResolvedValue([{ id: 'job-1' }])
    mockGetJobDetail.mockResolvedValue({
      outputs: {
        '5': { histogram: [1, 1] },
        '6': { histogram: [2, 2] }
      }
    })

    const store = useNodeOutputStore()
    await hydrateHistogramFromHistory(locator('5'))
    await hydrateHistogramFromHistory(locator('6'))

    expect(store.nodeOutputs['5']?.histogram).toEqual([1, 1])
    expect(store.nodeOutputs['6']?.histogram).toEqual([2, 2])
  })
})
