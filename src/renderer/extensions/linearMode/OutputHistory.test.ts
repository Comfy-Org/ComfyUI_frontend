import type { VueWrapper } from '@vue/test-utils'
import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComputedRef } from 'vue'
import { computed, nextTick, ref } from 'vue'

import type { IAssetsProvider } from '@/platform/assets/composables/media/IAssetsProvider'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type {
  InProgressItem,
  OutputSelection
} from '@/renderer/extensions/linearMode/linearModeTypes'
import type { ResultItemImpl } from '@/stores/queueStore'

import OutputHistory from './OutputHistory.vue'

// --- Hoisted mock state ---

const mediaRef = ref<AssetItem[]>([])
const hasMoreRef = ref(false)
const loadMoreFn = vi.fn()

const selectedIdRef = ref<string | null>(null)
const activeWorkflowInProgressItemsRef = ref<InProgressItem[]>([])

const activeWorkflowPathRef = ref<string | undefined>('workflows/test.json')
const hasOutputsRef = ref(false)

const runningTasksRef = ref<Array<{ jobId: string }>>([])
const pendingTasksRef = ref<Array<{ jobId: string }>>([])

const selectFirstHistoryFn = vi.fn()
const mayBeActiveWorkflowPendingRef = ref(false)

const allOutputsFn = vi.fn((): ResultItemImpl[] => [])

// Stateful select mocks that update selectedIdRef
const selectFn = vi.fn((id: string | null) => {
  selectedIdRef.value = id
})
const selectAsLatestFn = vi.fn((id: string | null) => {
  selectedIdRef.value = id
})

// --- Mocks ---

vi.mock('@/lib/litegraph/src/CanvasPointer', () => ({
  CanvasPointer: class {
    isTrackpadGesture() {
      return false
    }
  }
}))

vi.mock('@/renderer/extensions/linearMode/useOutputHistory', () => ({
  useOutputHistory: () => ({
    outputs: {
      media: mediaRef,
      hasMore: hasMoreRef,
      loadMore: loadMoreFn,
      isLoadingMore: ref(false),
      loading: ref(false),
      error: ref(null),
      fetchMediaList: vi.fn(),
      refresh: vi.fn()
    } satisfies Partial<IAssetsProvider> as unknown as IAssetsProvider,
    allOutputs: allOutputsFn,
    selectFirstHistory: selectFirstHistoryFn,
    mayBeActiveWorkflowPending:
      mayBeActiveWorkflowPendingRef as ComputedRef<boolean>,
    isWorkflowActive: computed(() => false),
    cancelActiveWorkflowJobs: vi.fn()
  })
}))

vi.mock('@/renderer/extensions/linearMode/linearOutputStore', () => ({
  useLinearOutputStore: () => ({
    get activeWorkflowInProgressItems() {
      return activeWorkflowInProgressItemsRef.value
    },
    get selectedId() {
      return selectedIdRef.value
    },
    set selectedId(v: string | null) {
      selectedIdRef.value = v
    },
    select: selectFn,
    selectAsLatest: selectAsLatestFn
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return activeWorkflowPathRef.value
        ? { path: activeWorkflowPathRef.value }
        : undefined
    }
  })
}))

vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => ({
    hasOutputs: hasOutputsRef
  })
}))

vi.mock('@/stores/queueStore', () => ({
  useQueueStore: () => ({
    get runningTasks() {
      return runningTasksRef.value
    },
    get pendingTasks() {
      return pendingTasksRef.value
    }
  })
}))

vi.mock(
  '@/renderer/extensions/linearMode/OutputHistoryActiveQueueItem.vue',
  () => ({
    default: { name: 'OutputHistoryActiveQueueItem', template: '<div />' }
  })
)

vi.mock('@/renderer/extensions/linearMode/OutputHistoryItem.vue', () => ({
  default: {
    name: 'OutputHistoryItem',
    props: ['output'],
    template: '<div class="history-item" />'
  }
}))

vi.mock('@/renderer/extensions/linearMode/OutputPreviewItem.vue', () => ({
  default: {
    name: 'OutputPreviewItem',
    props: ['latentPreview'],
    template: '<div class="preview-item" />'
  }
}))

function makeAsset(id: string): AssetItem {
  return { id, name: `${id}.png`, tags: [], user_metadata: {} }
}

function makeResult(filename: string): ResultItemImpl {
  return {
    filename,
    subfolder: '',
    type: 'output',
    nodeId: '1',
    mediaType: 'images',
    url: `http://localhost/${filename}`
  } as unknown as ResultItemImpl
}

function makeInProgressItem(
  id: string,
  state: InProgressItem['state'] = 'skeleton',
  opts?: Partial<InProgressItem>
): InProgressItem {
  return { id, jobId: `job-${id}`, state, ...opts }
}

// Track mounted wrappers for cleanup
let activeWrapper: VueWrapper | null = null

function mountComponent() {
  const wrapper = shallowMount(OutputHistory)
  activeWrapper = wrapper
  return wrapper
}

function lastEmission(wrapper: VueWrapper): OutputSelection {
  const emitted = wrapper.emitted('updateSelection')
  expect(emitted).toBeDefined()
  return emitted![emitted!.length - 1][0] as OutputSelection
}

describe('OutputHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mediaRef.value = []
    hasMoreRef.value = false
    selectedIdRef.value = null
    activeWorkflowInProgressItemsRef.value = []
    activeWorkflowPathRef.value = 'workflows/test.json'
    hasOutputsRef.value = false
    runningTasksRef.value = []
    pendingTasksRef.value = []
    mayBeActiveWorkflowPendingRef.value = false
    allOutputsFn.mockReturnValue([])
  })

  afterEach(() => {
    activeWrapper?.unmount()
    activeWrapper = null
  })

  describe('rendering', () => {
    it('renders selectable history items for assets with outputs', async () => {
      const a1 = makeAsset('a1')
      const a2 = makeAsset('a2')
      mediaRef.value = [a1, a2]
      allOutputsFn.mockImplementation((asset?: AssetItem) => {
        if (asset?.id === 'a1') return [makeResult('a1.png')]
        return []
      })

      const wrapper = mountComponent()
      await nextTick()

      // Only a1 has outputs, so only 1 history item rendered
      const historyItems = wrapper.findAllComponents({
        name: 'OutputHistoryItem'
      })
      expect(historyItems).toHaveLength(1)
    })

    it('renders queue badge when queueCount > 1 and has active content', async () => {
      runningTasksRef.value = [{ jobId: 'j1' }]
      pendingTasksRef.value = [{ jobId: 'j2' }]
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'skeleton')
      ]

      const wrapper = mountComponent()
      await nextTick()

      expect(
        wrapper.findComponent({ name: 'OutputHistoryActiveQueueItem' }).exists()
      ).toBe(true)
    })

    it('does not render queue badge when queue is empty', () => {
      const wrapper = mountComponent()
      expect(
        wrapper.findComponent({ name: 'OutputHistoryActiveQueueItem' }).exists()
      ).toBe(false)
    })

    it('renders preview item for skeleton in-progress items', async () => {
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'skeleton')
      ]

      const wrapper = mountComponent()
      await nextTick()

      expect(
        wrapper.findComponent({ name: 'OutputPreviewItem' }).exists()
      ).toBe(true)
    })

    it('renders history item for image in-progress items', async () => {
      const output = makeResult('out.png')
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'image', { output })
      ]

      const wrapper = mountComponent()
      await nextTick()

      expect(
        wrapper.findComponent({ name: 'OutputHistoryItem' }).exists()
      ).toBe(true)
    })

    it('renders divider between active content and history', async () => {
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'skeleton')
      ]
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('a1.png')])

      const wrapper = mountComponent()
      await nextTick()

      expect(wrapper.find('.border-l').exists()).toBe(true)
    })
  })

  describe('selection behavior', () => {
    it('selects history item on click and updates data-state', async () => {
      const asset = makeAsset('a1')
      mediaRef.value = [asset]
      allOutputsFn.mockReturnValue([makeResult('a1.png')])

      const wrapper = mountComponent()
      await nextTick()

      const items = wrapper.findAll('[data-state]')
      expect(items).toHaveLength(1)

      await items[0].trigger('click')
      await nextTick()

      expect(selectedIdRef.value).toBe('history:a1:0')
      expect(items[0].attributes('data-state')).toBe('checked')
      expect(items[0].attributes('tabindex')).toBe('0')
    })

    it('selects in-progress item on click', async () => {
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'skeleton')
      ]

      const wrapper = mountComponent()
      await nextTick()

      const slots = wrapper.findAll('[data-state]')
      expect(slots.length).toBeGreaterThanOrEqual(1)

      await slots[0].trigger('click')
      expect(selectedIdRef.value).toBe('slot:ip1')
    })

    it('marks unselected items with tabindex=-1', async () => {
      const a1 = makeAsset('a1')
      const a2 = makeAsset('a2')
      mediaRef.value = [a1, a2]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      selectedIdRef.value = 'history:a1:0'

      const wrapper = mountComponent()
      await nextTick()

      const unchecked = wrapper.findAll('[data-state="unchecked"]')
      for (const item of unchecked) {
        expect(item.attributes('tabindex')).toBe('-1')
      }
    })

    it('selects pending slot on click', async () => {
      mayBeActiveWorkflowPendingRef.value = true
      runningTasksRef.value = [{ jobId: 'j1' }]

      const wrapper = mountComponent()
      await nextTick()

      const slots = wrapper.findAll('[data-state]')
      expect(slots.length).toBeGreaterThanOrEqual(1)

      await slots[0].trigger('click')
      expect(selectedIdRef.value).toBe('slot:pending')
    })
  })

  describe('emit updateSelection', () => {
    it('emits canShowPreview:true when no selection', async () => {
      selectedIdRef.value = null

      const wrapper = mountComponent()
      await nextTick()

      expect(lastEmission(wrapper)).toEqual({ canShowPreview: true })
    })

    it('emits showSkeleton for in-progress skeleton item', async () => {
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'skeleton')
      ]
      selectedIdRef.value = 'slot:ip1'

      const wrapper = mountComponent()
      await nextTick()
      await nextTick()

      expect(lastEmission(wrapper)).toMatchObject({
        canShowPreview: true,
        showSkeleton: true
      })
    })

    it('emits latentPreviewUrl for in-progress latent item', async () => {
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'latent', {
          latentPreviewUrl: 'blob:preview'
        })
      ]
      selectedIdRef.value = 'slot:ip1'

      const wrapper = mountComponent()
      await nextTick()
      await nextTick()

      expect(lastEmission(wrapper)).toMatchObject({
        canShowPreview: true,
        latentPreviewUrl: 'blob:preview'
      })
    })

    it('emits output for in-progress image item', async () => {
      const output = makeResult('out.png')
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'image', { output })
      ]
      selectedIdRef.value = 'slot:ip1'

      const wrapper = mountComponent()
      await nextTick()
      await nextTick()

      expect(lastEmission(wrapper)).toMatchObject({
        output,
        canShowPreview: true
      })
    })

    it('emits asset and output for history selection', async () => {
      const asset = makeAsset('a1')
      const result = makeResult('a1.png')
      mediaRef.value = [asset]
      allOutputsFn.mockReturnValue([result])
      hasOutputsRef.value = true

      const wrapper = mountComponent()
      await nextTick()

      // Set selection after mount
      selectedIdRef.value = 'history:a1:0'
      await nextTick()
      await nextTick()

      expect(lastEmission(wrapper)).toMatchObject({
        asset,
        output: result,
        canShowPreview: true
      })
    })

    it('sets canShowPreview:false for non-first history asset', async () => {
      const a1 = makeAsset('a1')
      const a2 = makeAsset('a2')
      mediaRef.value = [a1, a2]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      hasOutputsRef.value = true

      const wrapper = mountComponent()
      await nextTick()

      selectedIdRef.value = 'history:a2:0'
      await nextTick()
      await nextTick()

      expect(lastEmission(wrapper).canShowPreview).toBe(false)
    })

    it('emits skeleton for pending slot selection', async () => {
      mayBeActiveWorkflowPendingRef.value = true
      runningTasksRef.value = [{ jobId: 'j1' }]

      const wrapper = mountComponent()
      await nextTick()

      selectedIdRef.value = 'slot:pending'
      await nextTick()
      await nextTick()

      expect(lastEmission(wrapper)).toMatchObject({
        canShowPreview: true,
        showSkeleton: true
      })
    })
  })

  describe('workflow tab switch', () => {
    it('selects first in-progress item on mount', async () => {
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'skeleton')
      ]

      mountComponent()
      await nextTick()

      expect(selectAsLatestFn).toHaveBeenCalledWith('slot:ip1')
    })

    it('selects first history when no in-progress but outputs exist', async () => {
      hasOutputsRef.value = true

      mountComponent()
      await nextTick()

      expect(selectFirstHistoryFn).toHaveBeenCalled()
    })

    it('clears selection when no outputs and no in-progress', async () => {
      mountComponent()
      await nextTick()

      expect(selectAsLatestFn).toHaveBeenCalledWith(null)
    })

    it('reselects when workflow path changes after mount', async () => {
      hasOutputsRef.value = true

      mountComponent()
      await nextTick()

      vi.clearAllMocks()

      // Simulate workflow tab switch
      activeWorkflowPathRef.value = 'workflows/other.json'
      await nextTick()

      expect(selectFirstHistoryFn).toHaveBeenCalled()
    })

    it('does not reselect when path becomes falsy', async () => {
      mountComponent()
      await nextTick()

      vi.clearAllMocks()

      activeWorkflowPathRef.value = undefined
      await nextTick()

      expect(selectAsLatestFn).not.toHaveBeenCalled()
      expect(selectFirstHistoryFn).not.toHaveBeenCalled()
    })
  })

  describe('media change watcher', () => {
    it('does not reselect when selection is a slot item', async () => {
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'skeleton')
      ]
      selectedIdRef.value = 'slot:ip1'

      mountComponent()
      await nextTick()

      vi.clearAllMocks()

      // New media arrives
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('a1.png')])
      await nextTick()

      // Selection stays on slot, doesn't jump to history
      expect(selectFirstHistoryFn).not.toHaveBeenCalled()
    })

    it('reselects first history when selected asset disappears', async () => {
      const a1 = makeAsset('a1')
      const a2 = makeAsset('a2')
      mediaRef.value = [a1, a2]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      hasOutputsRef.value = true

      mountComponent()
      await nextTick()
      selectedIdRef.value = 'history:a1:0'
      await nextTick()

      vi.clearAllMocks()

      // a1 disappears — length changes, selected asset is gone
      mediaRef.value = [a2]
      await nextTick()

      expect(selectFirstHistoryFn).toHaveBeenCalled()
    })
  })

  describe('keyboard navigation', () => {
    function pressKey(key: string) {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true })
      )
    }

    it('navigates forward and backward with arrow keys', async () => {
      const a1 = makeAsset('a1')
      const a2 = makeAsset('a2')
      mediaRef.value = [a1, a2]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      hasOutputsRef.value = true

      mountComponent()
      await nextTick()

      // Set selection after mount (mount watcher may reset it)
      selectedIdRef.value = 'history:a1:0'
      await nextTick()

      pressKey('ArrowRight')
      await nextTick()
      expect(selectedIdRef.value).toBe('history:a2:0')

      pressKey('ArrowLeft')
      await nextTick()
      expect(selectedIdRef.value).toBe('history:a1:0')

      pressKey('ArrowDown')
      await nextTick()
      expect(selectedIdRef.value).toBe('history:a2:0')

      pressKey('ArrowUp')
      await nextTick()
      expect(selectedIdRef.value).toBe('history:a1:0')
    })

    it('clamps to first and last items', async () => {
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      hasOutputsRef.value = true

      mountComponent()
      await nextTick()
      selectedIdRef.value = 'history:a1:0'
      await nextTick()

      pressKey('ArrowLeft')
      await nextTick()
      expect(selectedIdRef.value).toBe('history:a1:0')

      pressKey('ArrowRight')
      await nextTick()
      expect(selectedIdRef.value).toBe('history:a1:0')
    })

    it('ignores key events from input elements', async () => {
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      hasOutputsRef.value = true

      mountComponent()
      await nextTick()
      selectedIdRef.value = 'history:a1:0'
      vi.clearAllMocks()
      await nextTick()

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true
        })
      )
      await nextTick()

      expect(selectFn).not.toHaveBeenCalled()
      document.body.removeChild(input)
    })

    it('navigates across in-progress and history items', async () => {
      activeWorkflowInProgressItemsRef.value = [
        makeInProgressItem('ip1', 'skeleton')
      ]
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('out.png')])

      mountComponent()
      await nextTick()

      // Mount watcher selects the in-progress item
      expect(selectedIdRef.value).toBe('slot:ip1')

      pressKey('ArrowRight')
      await nextTick()
      expect(selectedIdRef.value).toBe('history:a1:0')
    })

    it('selects first item when no current selection', async () => {
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('out.png')])

      mountComponent()
      await nextTick()
      selectedIdRef.value = null
      await nextTick()

      pressKey('ArrowRight')
      await nextTick()
      expect(selectedIdRef.value).toBe('history:a1:0')
    })
  })
})
