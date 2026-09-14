import { useLinearOutputStore } from '@/renderer/extensions/linearMode/linearOutputStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useAppModeStore } from '@/stores/appModeStore'
import { useQueueStore } from '@/stores/queueStore'
import { fromPartial } from '@total-typescript/shoehorn'

import type { RenderResult } from '@testing-library/vue'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComputedRef } from 'vue'
import { computed, nextTick, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type {
  InProgressItem,
  OutputSelection
} from '@/renderer/extensions/linearMode/linearModeTypes'
import type { AugmentedResultItem } from '@/utils/resultItem'
import type { PagedList } from '@/utils/pagedList'

import OutputHistory from './OutputHistory.vue'

const mediaRef = ref<AssetItem[]>([])
const hasMoreRef = ref(false)
const loadMoreFn = vi.fn()

const selectFirstHistoryFn = vi.fn(() => {
  const first = mediaRef.value.at(0)
  useLinearOutputStore().selectedId = first ? `history:${first.id}:0` : null
})
const mayBeActiveWorkflowPendingRef = ref(false)

const allOutputsFn = vi.fn((): AugmentedResultItem[] => [])

vi.mock<unknown>(import('@/lib/litegraph/src/CanvasPointer'), () => ({
  CanvasPointer: class {
    isTrackpadGesture() {
      return false
    }
  }
}))

vi.mock(import('@/renderer/extensions/linearMode/useOutputHistory'), () => ({
  useOutputHistory: () => ({
    outputs: {
      hasMore: hasMoreRef,
      invalidate: vi.fn(),
      isLoading: ref(false),
      items: mediaRef,
      loadMore: loadMoreFn,
      loadNew: vi.fn()
    } satisfies PagedList<AssetItem>,
    allOutputs: allOutputsFn,
    selectFirstHistory: selectFirstHistoryFn,
    mayBeActiveWorkflowPending:
      mayBeActiveWorkflowPendingRef as ComputedRef<boolean>,
    isWorkflowActive: computed(() => false),
    cancelActiveWorkflowJobs: vi.fn()
  })
}))

vi.mock<unknown>(
  import('@/renderer/extensions/linearMode/OutputHistoryActiveQueueItem.vue'),
  () => ({
    default: {
      name: 'OutputHistoryActiveQueueItem',
      template: '<div data-testid="output-active-queue-item" />'
    }
  })
)

vi.mock<unknown>(
  import('@/renderer/extensions/linearMode/OutputHistoryItem.vue'),
  () => ({
    default: {
      name: 'OutputHistoryItem',
      props: ['output'],
      template:
        '<div data-testid="output-history-item">{{ output?.filename }}</div>'
    }
  })
)

vi.mock<unknown>(
  import('@/renderer/extensions/linearMode/OutputPreviewItem.vue'),
  () => ({
    default: {
      name: 'OutputPreviewItem',
      props: ['latentPreview'],
      template:
        '<div data-testid="output-preview-item">{{ latentPreview }}</div>'
    }
  })
)

function makeAsset(id: string): AssetItem {
  return fromPartial({ id, name: `${id}.png`, tags: [], user_metadata: {} })
}

function makeResult(filename: string): AugmentedResultItem {
  return {
    filename,
    subfolder: '',
    type: 'output',
    nodeId: '1',
    mediaType: 'images',
    url: `http://localhost/${filename}`
  }
}

function makeInProgressItem(
  id: string,
  state: InProgressItem['state'] = 'skeleton',
  opts?: Partial<InProgressItem>
): InProgressItem {
  return { id, jobId: `job-${id}`, state, ...opts }
}

let activeResult: RenderResult | null = null

function mountComponent() {
  const result = render(OutputHistory)
  activeResult = result
  return result
}

function lastEmission(result: RenderResult): OutputSelection {
  const emitted = result.emitted('updateSelection') as
    | Array<[OutputSelection]>
    | undefined
  expect(emitted).toBeDefined()
  return emitted![emitted!.length - 1][0]
}

function historySelectableItems(): HTMLElement[] {
  return screen.getAllByTestId('linear-history-item')
}

function historyItems(): HTMLElement[] {
  return screen.queryAllByTestId('output-history-item')
}

describe('OutputHistory', () => {
  beforeEach(() => {
    mediaRef.value = []
    hasMoreRef.value = false
    useLinearOutputStore().selectedId = null
    Object.assign(useLinearOutputStore(), { activeWorkflowInProgressItems: [] })
    useWorkflowStore().activeWorkflow = fromPartial({
      path: 'workflows/test.json'
    })
    Object.assign(useAppModeStore(), { hasOutputs: false })
    useQueueStore().runningTasks = []
    useQueueStore().pendingTasks = []
    mayBeActiveWorkflowPendingRef.value = false
    allOutputsFn.mockReturnValue([])
  })

  afterEach(() => {
    activeResult?.unmount()
    activeResult = null
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

      mountComponent()
      await nextTick()

      expect(historyItems()).toHaveLength(1)
      expect(historyItems()[0]).toHaveTextContent('a1.png')
    })

    it('renders a history item for each output in an asset', async () => {
      const asset = makeAsset('a1')
      const firstOutput = makeResult('first.png')
      const secondOutput = makeResult('second.png')
      mediaRef.value = [asset]
      allOutputsFn.mockReturnValue([firstOutput, secondOutput])

      mountComponent()
      await nextTick()

      expect(historyItems()).toHaveLength(2)
      expect(historyItems()[0]).toHaveTextContent('first.png')
      expect(historyItems()[1]).toHaveTextContent('second.png')
    })

    it('renders queue badge when queueCount > 1 and has active content', async () => {
      useQueueStore().runningTasks = fromPartial([{ jobId: 'j1' }])
      useQueueStore().pendingTasks = fromPartial([{ jobId: 'j2' }])
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [makeInProgressItem('ip1', 'skeleton')]
      })

      mountComponent()
      await nextTick()

      expect(screen.getByTestId('output-active-queue-item')).toBeInTheDocument()
    })

    it('does not render queue badge when queue is empty', () => {
      mountComponent()
      expect(
        screen.queryByTestId('output-active-queue-item')
      ).not.toBeInTheDocument()
    })

    it('renders preview item for skeleton in-progress items', async () => {
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [makeInProgressItem('ip1', 'skeleton')]
      })

      mountComponent()
      await nextTick()

      expect(screen.getByTestId('output-preview-item')).toBeInTheDocument()
    })

    it('renders history item for image in-progress items with output prop', async () => {
      const output = makeResult('out.png')
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [
          makeInProgressItem('ip1', 'image', { output })
        ]
      })

      mountComponent()
      await nextTick()

      expect(screen.getByTestId('output-history-item')).toHaveTextContent(
        output.filename
      )
    })

    it('renders both active and history content when both exist', async () => {
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [makeInProgressItem('ip1', 'skeleton')]
      })
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('a1.png')])

      mountComponent()
      await nextTick()

      expect(screen.getByTestId('output-preview-item')).toBeInTheDocument()
      expect(screen.getByTestId('output-history-item')).toBeInTheDocument()
    })
  })

  describe('selection behavior', () => {
    it('selects history item on click and updates data-state', async () => {
      const asset = makeAsset('a1')
      mediaRef.value = [asset]
      allOutputsFn.mockReturnValue([makeResult('a1.png')])

      const result = mountComponent()
      await nextTick()

      const items = historySelectableItems()
      expect(items).toHaveLength(1)

      await userEvent.click(items[0])
      await nextTick()

      expect(useLinearOutputStore().selectedId).toBe('history:a1:0')
      expect(vi.mocked(useLinearOutputStore().select)).toHaveBeenCalledWith(
        'history:a1:0'
      )
      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).not.toHaveBeenCalledWith('history:a1:0')
      expect(lastEmission(result)).toMatchObject({
        asset,
        output: expect.objectContaining({ filename: 'a1.png' }),
        canShowPreview: true
      })
      expect(items[0]).toHaveAttribute('data-state', 'checked')
      expect(items[0]).toHaveAttribute('tabindex', '0')
    })

    it('selects in-progress item on click', async () => {
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [makeInProgressItem('ip1', 'skeleton')]
      })

      mountComponent()
      await nextTick()

      const slots = screen.getAllByTestId('linear-in-progress-item')
      expect(slots.length).toBeGreaterThanOrEqual(1)

      vi.clearAllMocks()
      await userEvent.click(slots[0])
      expect(useLinearOutputStore().selectedId).toBe('slot:ip1')
      expect(vi.mocked(useLinearOutputStore().select)).toHaveBeenCalledWith(
        'slot:ip1'
      )
      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).not.toHaveBeenCalledWith('slot:ip1')
    })

    it('marks unselected items with tabindex=-1', async () => {
      const a1 = makeAsset('a1')
      const a2 = makeAsset('a2')
      mediaRef.value = [a1, a2]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      useLinearOutputStore().selectedId = 'history:a1:0'

      mountComponent()
      await nextTick()

      const unchecked = screen
        .getAllByTestId('linear-history-item')
        .filter((item) => item.dataset.state === 'unchecked')
      for (const item of unchecked) {
        expect(item).toHaveAttribute('tabindex', '-1')
      }
    })

    it('selects pending slot on click', async () => {
      mayBeActiveWorkflowPendingRef.value = true
      useQueueStore().runningTasks = fromPartial([{ jobId: 'j1' }])

      mountComponent()
      await nextTick()

      const pendingPreview = screen.getByTestId('output-preview-item')

      await userEvent.click(pendingPreview)
      expect(useLinearOutputStore().selectedId).toBe('slot:pending')
    })
  })

  describe('emit updateSelection', () => {
    it('emits canShowPreview:true when no selection', async () => {
      useLinearOutputStore().selectedId = null

      const result = mountComponent()
      await nextTick()

      expect(lastEmission(result)).toEqual({ canShowPreview: true })
    })

    it('emits showSkeleton for in-progress skeleton item', async () => {
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [makeInProgressItem('ip1', 'skeleton')]
      })
      useLinearOutputStore().selectedId = 'slot:ip1'

      const result = mountComponent()
      await nextTick()
      await nextTick()

      expect(lastEmission(result)).toMatchObject({
        canShowPreview: true,
        showSkeleton: true
      })
    })

    it('emits latentPreviewUrl for in-progress latent item', async () => {
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [
          makeInProgressItem('ip1', 'latent', {
            latentPreviewUrl: 'blob:preview'
          })
        ]
      })
      useLinearOutputStore().selectedId = 'slot:ip1'

      const result = mountComponent()
      await nextTick()
      await nextTick()

      expect(lastEmission(result)).toMatchObject({
        canShowPreview: true,
        latentPreviewUrl: 'blob:preview'
      })
    })

    it('emits output for in-progress image item', async () => {
      const output = makeResult('out.png')
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [
          makeInProgressItem('ip1', 'image', { output })
        ]
      })
      useLinearOutputStore().selectedId = 'slot:ip1'

      const result = mountComponent()
      await nextTick()
      await nextTick()

      expect(lastEmission(result)).toMatchObject({
        output,
        canShowPreview: true
      })
    })

    it('emits asset and output for history selection', async () => {
      const asset = makeAsset('a1')
      const output = makeResult('a1.png')
      mediaRef.value = [asset]
      allOutputsFn.mockReturnValue([output])
      Object.assign(useAppModeStore(), { hasOutputs: true })

      const rendered = mountComponent()
      await nextTick()

      useLinearOutputStore().selectedId = 'history:a1:0'
      await nextTick()
      await nextTick()

      expect(lastEmission(rendered)).toMatchObject({
        asset,
        output,
        canShowPreview: true
      })
    })

    it('emits the selected output for multi-output history assets', async () => {
      const asset = makeAsset('a1')
      const firstOutput = makeResult('first.png')
      const secondOutput = makeResult('second.png')
      mediaRef.value = [asset]
      allOutputsFn.mockReturnValue([firstOutput, secondOutput])
      Object.assign(useAppModeStore(), { hasOutputs: true })

      const result = mountComponent()
      await nextTick()

      useLinearOutputStore().selectedId = 'history:a1:1'
      await nextTick()
      await nextTick()

      expect(lastEmission(result)).toMatchObject({
        asset,
        output: secondOutput,
        canShowPreview: true
      })
    })

    it('sets canShowPreview:false for non-first history asset', async () => {
      const a1 = makeAsset('a1')
      const a2 = makeAsset('a2')
      mediaRef.value = [a1, a2]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      Object.assign(useAppModeStore(), { hasOutputs: true })

      const result = mountComponent()
      await nextTick()

      useLinearOutputStore().selectedId = 'history:a2:0'
      await nextTick()
      await nextTick()

      expect(lastEmission(result).canShowPreview).toBe(false)
    })

    it('emits skeleton for pending slot selection', async () => {
      mayBeActiveWorkflowPendingRef.value = true
      useQueueStore().runningTasks = fromPartial([{ jobId: 'j1' }])

      const result = mountComponent()
      await nextTick()

      useLinearOutputStore().selectedId = 'slot:pending'
      await nextTick()
      await nextTick()

      expect(lastEmission(result)).toMatchObject({
        canShowPreview: true,
        showSkeleton: true
      })
    })
  })

  describe('workflow tab switch', () => {
    it('selects first in-progress item on mount', async () => {
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [makeInProgressItem('ip1', 'skeleton')]
      })

      mountComponent()
      await nextTick()

      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).toHaveBeenCalledWith('slot:ip1')
    })

    it('selects first history when no in-progress but outputs exist', async () => {
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('a1.png')])
      Object.assign(useAppModeStore(), { hasOutputs: true })

      mountComponent()
      await nextTick()

      expect(selectFirstHistoryFn).toHaveBeenCalled()
      expect(useLinearOutputStore().selectedId).toBe('history:a1:0')
    })

    it('clears selection when no outputs and no in-progress', async () => {
      mountComponent()
      await nextTick()

      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).toHaveBeenCalledWith(null)
    })

    it('reselects when workflow path changes after mount', async () => {
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('a1.png')])
      Object.assign(useAppModeStore(), { hasOutputs: true })

      mountComponent()
      await nextTick()

      vi.clearAllMocks()

      // Simulate workflow tab switch
      useWorkflowStore().activeWorkflow = fromPartial({
        path: 'workflows/other.json'
      })
      await nextTick()

      expect(selectFirstHistoryFn).toHaveBeenCalled()
      expect(useLinearOutputStore().selectedId).toBe('history:a1:0')
    })

    it('does not reselect when path becomes falsy', async () => {
      mountComponent()
      await nextTick()

      vi.clearAllMocks()

      useWorkflowStore().activeWorkflow = null
      await nextTick()

      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).not.toHaveBeenCalled()
      expect(selectFirstHistoryFn).not.toHaveBeenCalled()
    })
  })

  describe('media change watcher', () => {
    it('does not reselect when selection is a slot item', async () => {
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [makeInProgressItem('ip1', 'skeleton')]
      })
      useLinearOutputStore().selectedId = 'slot:ip1'

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
      Object.assign(useAppModeStore(), { hasOutputs: true })

      mountComponent()
      await nextTick()
      useLinearOutputStore().selectedId = 'history:a1:0'
      await nextTick()

      vi.clearAllMocks()

      // a1 disappears — length changes, selected asset is gone
      mediaRef.value = [a2]
      await nextTick()

      expect(selectFirstHistoryFn).toHaveBeenCalled()
    })

    it('reselects latest history when a new asset is prepended while following latest', async () => {
      const oldFirst = makeAsset('old-first')
      mediaRef.value = [oldFirst]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      Object.assign(useAppModeStore(), { hasOutputs: true })

      mountComponent()
      await nextTick()
      useLinearOutputStore().selectedId = 'history:old-first:0'
      await nextTick()

      vi.clearAllMocks()

      mediaRef.value = [makeAsset('new-first'), oldFirst]
      await nextTick()

      expect(selectFirstHistoryFn).toHaveBeenCalled()
      expect(useLinearOutputStore().selectedId).toBe('history:new-first:0')
    })

    it('keeps older history selection stable when new assets arrive', async () => {
      const currentFirst = makeAsset('current-first')
      const selectedOlder = makeAsset('selected-older')
      mediaRef.value = [currentFirst, selectedOlder]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      Object.assign(useAppModeStore(), { hasOutputs: true })

      mountComponent()
      await nextTick()
      useLinearOutputStore().selectedId = 'history:selected-older:0'
      await nextTick()

      vi.clearAllMocks()

      mediaRef.value = [makeAsset('new-first'), currentFirst, selectedOlder]
      await nextTick()

      expect(selectFirstHistoryFn).not.toHaveBeenCalled()
      expect(useLinearOutputStore().selectedId).toBe('history:selected-older:0')
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
      Object.assign(useAppModeStore(), { hasOutputs: true })

      mountComponent()
      await nextTick()

      // Set selection after mount (mount watcher may reset it)
      useLinearOutputStore().selectedId = 'history:a1:0'
      await nextTick()

      pressKey('ArrowRight')
      await nextTick()
      expect(useLinearOutputStore().selectedId).toBe('history:a2:0')
      expect(vi.mocked(useLinearOutputStore().select)).toHaveBeenLastCalledWith(
        'history:a2:0'
      )
      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).not.toHaveBeenCalledWith('history:a2:0')

      pressKey('ArrowLeft')
      await nextTick()
      expect(useLinearOutputStore().selectedId).toBe('history:a1:0')
      expect(vi.mocked(useLinearOutputStore().select)).toHaveBeenLastCalledWith(
        'history:a1:0'
      )
      expect(
        vi.mocked(useLinearOutputStore().selectAsLatest)
      ).not.toHaveBeenCalledWith('history:a1:0')

      pressKey('ArrowDown')
      await nextTick()
      expect(useLinearOutputStore().selectedId).toBe('history:a2:0')

      pressKey('ArrowUp')
      await nextTick()
      expect(useLinearOutputStore().selectedId).toBe('history:a1:0')
    })

    it('clamps to first and last items', async () => {
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      Object.assign(useAppModeStore(), { hasOutputs: true })

      mountComponent()
      await nextTick()
      useLinearOutputStore().selectedId = 'history:a1:0'
      await nextTick()

      pressKey('ArrowLeft')
      await nextTick()
      expect(useLinearOutputStore().selectedId).toBe('history:a1:0')

      pressKey('ArrowRight')
      await nextTick()
      expect(useLinearOutputStore().selectedId).toBe('history:a1:0')
    })

    it('ignores key events from input elements', async () => {
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('out.png')])
      Object.assign(useAppModeStore(), { hasOutputs: true })

      mountComponent()
      await nextTick()
      useLinearOutputStore().selectedId = 'history:a1:0'
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

      expect(vi.mocked(useLinearOutputStore().select)).not.toHaveBeenCalled()
      document.body.removeChild(input)
    })

    it('navigates across in-progress and history items', async () => {
      Object.assign(useLinearOutputStore(), {
        activeWorkflowInProgressItems: [makeInProgressItem('ip1', 'skeleton')]
      })
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('out.png')])

      mountComponent()
      await nextTick()

      // Mount watcher selects the in-progress item
      expect(useLinearOutputStore().selectedId).toBe('slot:ip1')

      pressKey('ArrowRight')
      await nextTick()
      expect(useLinearOutputStore().selectedId).toBe('history:a1:0')
    })

    it('selects first item when no current selection', async () => {
      mediaRef.value = [makeAsset('a1')]
      allOutputsFn.mockReturnValue([makeResult('out.png')])

      mountComponent()
      await nextTick()
      useLinearOutputStore().selectedId = null
      await nextTick()

      pressKey('ArrowRight')
      await nextTick()
      expect(useLinearOutputStore().selectedId).toBe('history:a1:0')
    })
  })
})
