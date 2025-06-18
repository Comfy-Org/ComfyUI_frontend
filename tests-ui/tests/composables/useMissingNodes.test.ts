import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useMissingNodes } from '@/composables/nodePack/useMissingNodes'
import { useWorkflowPacks } from '@/composables/nodePack/useWorkflowPacks'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'

// Mock Vue's onMounted to execute immediately for testing
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: (cb: () => void) => cb()
  }
})

// Mock the dependencies
vi.mock('@/composables/nodePack/useWorkflowPacks', () => ({
  useWorkflowPacks: vi.fn()
}))

vi.mock('@/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn()
}))

const mockUseWorkflowPacks = vi.mocked(useWorkflowPacks)
const mockUseComfyManagerStore = vi.mocked(useComfyManagerStore)

describe('useMissingNodes', () => {
  const mockWorkflowPacks = [
    {
      id: 'pack-1',
      name: 'Test Pack 1',
      latest_version: { version: '1.0.0' }
    },
    {
      id: 'pack-2',
      name: 'Test Pack 2',
      latest_version: { version: '2.0.0' }
    },
    {
      id: 'pack-3',
      name: 'Installed Pack',
      latest_version: { version: '1.5.0' }
    }
  ]

  const mockStartFetchWorkflowPacks = vi.fn()
  const mockIsPackInstalled = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default setup: pack-3 is installed, others are not
    mockIsPackInstalled.mockImplementation((id: string) => id === 'pack-3')

    mockUseComfyManagerStore.mockReturnValue({
      isPackInstalled: mockIsPackInstalled
    } as any)

    mockUseWorkflowPacks.mockReturnValue({
      workflowPacks: ref([]),
      isLoading: ref(false),
      error: ref(null),
      startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
      isReady: ref(false),
      filterWorkflowPack: vi.fn()
    } as any)
  })

  describe('core filtering logic', () => {
    it('filters out installed packs correctly', () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref(mockWorkflowPacks),
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      } as any)

      const { missingNodePacks } = useMissingNodes()

      // Should only include packs that are not installed (pack-1, pack-2)
      expect(missingNodePacks.value).toHaveLength(2)
      expect(missingNodePacks.value[0].id).toBe('pack-1')
      expect(missingNodePacks.value[1].id).toBe('pack-2')
      expect(
        missingNodePacks.value.find((pack) => pack.id === 'pack-3')
      ).toBeUndefined()
    })

    it('returns empty array when all packs are installed', () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref(mockWorkflowPacks),
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      } as any)

      // Mock all packs as installed
      mockIsPackInstalled.mockReturnValue(true)

      const { missingNodePacks } = useMissingNodes()

      expect(missingNodePacks.value).toEqual([])
    })

    it('returns all packs when none are installed', () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref(mockWorkflowPacks),
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      } as any)

      // Mock no packs as installed
      mockIsPackInstalled.mockReturnValue(false)

      const { missingNodePacks } = useMissingNodes()

      expect(missingNodePacks.value).toHaveLength(3)
      expect(missingNodePacks.value).toEqual(mockWorkflowPacks)
    })

    it('returns empty array when no workflow packs exist', () => {
      const { missingNodePacks } = useMissingNodes()

      expect(missingNodePacks.value).toEqual([])
    })
  })

  describe('automatic data fetching', () => {
    it('fetches workflow packs automatically when none exist', async () => {
      useMissingNodes()

      expect(mockStartFetchWorkflowPacks).toHaveBeenCalledOnce()
    })

    it('does not fetch when packs already exist', async () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref(mockWorkflowPacks),
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      } as any)

      useMissingNodes()

      expect(mockStartFetchWorkflowPacks).not.toHaveBeenCalled()
    })

    it('does not fetch when already loading', async () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref([]),
        isLoading: ref(true),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(false),
        filterWorkflowPack: vi.fn()
      } as any)

      useMissingNodes()

      expect(mockStartFetchWorkflowPacks).not.toHaveBeenCalled()
    })
  })

  describe('state management', () => {
    it('exposes loading state from useWorkflowPacks', () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref([]),
        isLoading: ref(true),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(false),
        filterWorkflowPack: vi.fn()
      } as any)

      const { isLoading } = useMissingNodes()

      expect(isLoading.value).toBe(true)
    })

    it('exposes error state from useWorkflowPacks', () => {
      const testError = 'Failed to fetch workflow packs'
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref([]),
        isLoading: ref(false),
        error: ref(testError),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(false),
        filterWorkflowPack: vi.fn()
      } as any)

      const { error } = useMissingNodes()

      expect(error.value).toBe(testError)
    })
  })

  describe('reactivity', () => {
    it('updates when workflow packs change', async () => {
      const workflowPacksRef = ref([])
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: workflowPacksRef,
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      } as any)

      const { missingNodePacks } = useMissingNodes()

      // Initially empty
      expect(missingNodePacks.value).toEqual([])

      // Update workflow packs
      workflowPacksRef.value = mockWorkflowPacks as any
      await nextTick()

      // Should update missing packs (2 missing since pack-3 is installed)
      expect(missingNodePacks.value).toHaveLength(2)
    })
  })
})
