import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeSearchContent from '@/components/searchbox/v2/NodeSearchContent.vue'
import {
  createMockNodeDef,
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn((key: string) => {
      if (key === 'Comfy.NodeLibrary.Bookmarks.V2') return []
      if (key === 'Comfy.NodeLibrary.BookmarksCustomization') return {}
      return undefined
    }),
    set: vi.fn()
  }))
}))

describe('NodeSearchContent', () => {
  beforeEach(() => {
    setupTestPinia()
    vi.restoreAllMocks()
  })

  async function createRender(props = {}) {
    const user = userEvent.setup()
    const onAddNode = vi.fn()
    const onHoverNode = vi.fn()
    const onRemoveFilter = vi.fn()
    const onAddFilter = vi.fn()
    render(NodeSearchContent, {
      props: {
        filters: [],
        onAddNode,
        onHoverNode,
        onRemoveFilter,
        onAddFilter,
        ...props
      },
      global: {
        plugins: [testI18n],
        stubs: {
          NodeSearchListItem: {
            template:
              '<div class="node-item" data-testid="node-item">{{ nodeDef.display_name }}</div>',
            props: [
              'nodeDef',
              'currentQuery',
              'showDescription',
              'showSourceBadge',
              'hideBookmarkIcon'
            ]
          }
        }
      }
    })
    await nextTick()
    return { user, onAddNode, onHoverNode, onRemoveFilter, onAddFilter }
  }

  async function setupFavorites(
    nodes: Parameters<typeof createMockNodeDef>[0][]
  ) {
    useNodeDefStore().updateNodeDefs(nodes.map(createMockNodeDef))
    vi.spyOn(useNodeBookmarkStore(), 'isBookmarked').mockReturnValue(true)
    const result = await createRender()
    await result.user.click(screen.getByTestId('category-favorites'))
    await nextTick()
    return result
  }

  describe('category selection', () => {
    it('should show top nodes when Most relevant is selected', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'FrequentNode',
          display_name: 'Frequent Node'
        }),
        createMockNodeDef({ name: 'RareNode', display_name: 'Rare Node' })
      ])

      vi.spyOn(useNodeFrequencyStore(), 'topNodeDefs', 'get').mockReturnValue([
        useNodeDefStore().nodeDefsByName['FrequentNode']
      ])

      await createRender()

      const items = screen.getAllByTestId('node-item')
      expect(items).toHaveLength(1)
      expect(items[0]).toHaveTextContent('Frequent Node')
    })

    it('should show only bookmarked nodes when Favorites is selected', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'BookmarkedNode',
          display_name: 'Bookmarked Node'
        }),
        createMockNodeDef({
          name: 'RegularNode',
          display_name: 'Regular Node'
        })
      ])
      vi.spyOn(useNodeBookmarkStore(), 'isBookmarked').mockImplementation(
        (node: ComfyNodeDefImpl) => node.name === 'BookmarkedNode'
      )

      const { user } = await createRender()
      await user.click(screen.getByTestId('category-favorites'))
      await nextTick()

      const items = screen.getAllByTestId('node-item')
      expect(items).toHaveLength(1)
      expect(items[0]).toHaveTextContent('Bookmarked')
    })

    it('should show empty state when no bookmarks exist', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', display_name: 'Node One' })
      ])
      vi.spyOn(useNodeBookmarkStore(), 'isBookmarked').mockReturnValue(false)

      const { user } = await createRender()
      await user.click(screen.getByTestId('category-favorites'))
      await nextTick()

      expect(screen.getByText('No results')).toBeInTheDocument()
    })

    it('should show only CustomNodes when Extensions is selected', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'CoreNode',
          display_name: 'Core Node',
          python_module: 'nodes'
        }),
        createMockNodeDef({
          name: 'CustomNode',
          display_name: 'Custom Node',
          python_module: 'custom_nodes.my_extension'
        })
      ])
      await nextTick()

      expect(useNodeDefStore().nodeDefsByName['CoreNode'].nodeSource.type).toBe(
        NodeSourceType.Core
      )
      expect(
        useNodeDefStore().nodeDefsByName['CustomNode'].nodeSource.type
      ).toBe(NodeSourceType.CustomNodes)

      const { user } = await createRender()
      await user.click(screen.getByTestId('category-extensions'))
      await nextTick()

      const items = screen.getAllByTestId('node-item')
      expect(items).toHaveLength(1)
      expect(items[0]).toHaveTextContent('Custom Node')
    })

    it('should hide Essentials category when no essential nodes exist', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'RegularNode',
          display_name: 'Regular Node'
        })
      ])

      await createRender()
      expect(
        screen.queryByTestId('category-essentials')
      ).not.toBeInTheDocument()
    })

    it('should show only essential nodes when Essentials is selected', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'EssentialNode',
          display_name: 'Essential Node',
          essentials_category: 'basic'
        }),
        createMockNodeDef({
          name: 'RegularNode',
          display_name: 'Regular Node'
        })
      ])
      await nextTick()

      const { user } = await createRender()
      await user.click(screen.getByTestId('category-essentials'))
      await nextTick()

      const items = screen.getAllByTestId('node-item')
      expect(items).toHaveLength(1)
      expect(items[0]).toHaveTextContent('Essential Node')
    })

    it('should include subcategory nodes when parent category is selected', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'KSampler',
          display_name: 'KSampler',
          category: 'sampling'
        }),
        createMockNodeDef({
          name: 'LoadCheckpoint',
          display_name: 'Load Checkpoint',
          category: 'loaders'
        }),
        createMockNodeDef({
          name: 'KSamplerAdvanced',
          display_name: 'KSampler Advanced',
          category: 'sampling/advanced'
        })
      ])

      const { user } = await createRender()
      await user.click(screen.getByTestId('category-sampling'))
      await nextTick()

      const texts = screen.getAllByTestId('node-item').map((i) => i.textContent)
      expect(texts).toHaveLength(2)
      expect(texts).toContain('KSampler')
      expect(texts).toContain('KSampler Advanced')
    })
  })

  describe('search and category interaction', () => {
    it('should override category to most-relevant when search query is active', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'KSampler',
          display_name: 'KSampler',
          category: 'sampling'
        }),
        createMockNodeDef({
          name: 'LoadCheckpoint',
          display_name: 'Load Checkpoint',
          category: 'loaders'
        })
      ])

      const { user } = await createRender()
      await user.click(screen.getByTestId('category-sampling'))
      await nextTick()

      expect(screen.getAllByTestId('node-item')).toHaveLength(1)

      const input = screen.getByRole('combobox')
      await user.type(input, 'Load')
      await nextTick()

      const texts = screen.getAllByTestId('node-item').map((i) => i.textContent)
      expect(texts.some((t) => t?.includes('Load Checkpoint'))).toBe(true)
    })

    it('should clear search query when category changes', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'TestNode', display_name: 'Test Node' })
      ])

      const { user } = await createRender()

      const input = screen.getByRole('combobox')
      await user.type(input, 'test query')
      await nextTick()
      expect(input).toHaveValue('test query')

      await user.click(screen.getByTestId('category-favorites'))
      await nextTick()
      expect(input).toHaveValue('')
    })

    it('should reset selected index when search query changes', async () => {
      const { user } = await setupFavorites([
        { name: 'Node1', display_name: 'Node One' },
        { name: 'Node2', display_name: 'Node Two' }
      ])

      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.keyboard('{ArrowDown}')
      await nextTick()
      expect(screen.getAllByTestId('result-item')[1]).toHaveAttribute(
        'aria-selected',
        'true'
      )

      await user.type(input, 'Node')
      await nextTick()
      expect(screen.getAllByTestId('result-item')[0]).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })

    it('should reset selected index when category changes', async () => {
      const { user } = await setupFavorites([
        { name: 'Node1', display_name: 'Node One' },
        { name: 'Node2', display_name: 'Node Two' }
      ])

      await user.click(screen.getByRole('combobox'))
      await user.keyboard('{ArrowDown}')
      await nextTick()

      await user.click(screen.getByTestId('category-most-relevant'))
      await nextTick()
      await user.click(screen.getByTestId('category-favorites'))
      await nextTick()

      expect(screen.getAllByTestId('result-item')[0]).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })
  })

  describe('keyboard and mouse interaction', () => {
    it('should navigate results with ArrowDown/ArrowUp and clamp to bounds', async () => {
      const { user } = await setupFavorites([
        { name: 'Node1', display_name: 'Node One' },
        { name: 'Node2', display_name: 'Node Two' },
        { name: 'Node3', display_name: 'Node Three' }
      ])

      await user.click(screen.getByRole('combobox'))
      const selectedIndex = () =>
        screen
          .getAllByTestId('result-item')
          .findIndex((r) => r.getAttribute('aria-selected') === 'true')

      expect(selectedIndex()).toBe(0)

      await user.keyboard('{ArrowDown}')
      await nextTick()
      expect(selectedIndex()).toBe(1)

      await user.keyboard('{ArrowDown}')
      await nextTick()
      expect(selectedIndex()).toBe(2)

      await user.keyboard('{ArrowUp}')
      await nextTick()
      expect(selectedIndex()).toBe(1)

      // Navigate to first, then try going above — should clamp
      await user.keyboard('{ArrowUp}')
      await nextTick()
      expect(selectedIndex()).toBe(0)

      await user.keyboard('{ArrowUp}')
      await nextTick()
      expect(selectedIndex()).toBe(0)
    })

    it('should select current result with Enter key', async () => {
      const { user, onAddNode } = await setupFavorites([
        { name: 'TestNode', display_name: 'Test Node' }
      ])

      await user.click(screen.getByRole('combobox'))
      await user.keyboard('{Enter}')
      await nextTick()

      expect(onAddNode).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestNode' })
      )
    })

    it('should select item on hover', async () => {
      const { user } = await setupFavorites([
        { name: 'Node1', display_name: 'Node One' },
        { name: 'Node2', display_name: 'Node Two' }
      ])

      const results = screen.getAllByTestId('result-item')
      await user.hover(results[1])
      await nextTick()

      expect(results[1]).toHaveAttribute('aria-selected', 'true')
    })

    it('should add node on click', async () => {
      const { user, onAddNode } = await setupFavorites([
        { name: 'TestNode', display_name: 'Test Node' }
      ])

      await user.click(screen.getAllByTestId('result-item')[0])
      await nextTick()

      expect(onAddNode).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestNode' }),
        expect.any(PointerEvent)
      )
    })
  })

  describe('hoverNode emission', () => {
    it('should emit hoverNode with the currently selected node', async () => {
      const { onHoverNode } = await setupFavorites([
        { name: 'HoverNode', display_name: 'Hover Node' }
      ])

      const calls = onHoverNode.mock.calls
      expect(calls[calls.length - 1][0]).toMatchObject({
        name: 'HoverNode'
      })
    })

    it('should emit null hoverNode when no results', async () => {
      const { user, onHoverNode } = await createRender()

      vi.spyOn(useNodeBookmarkStore(), 'isBookmarked').mockReturnValue(false)
      await user.click(screen.getByTestId('category-favorites'))
      await nextTick()

      const calls = onHoverNode.mock.calls
      expect(calls[calls.length - 1][0]).toBeNull()
    })
  })

  describe('filter integration', () => {
    it('should display active filters in the input area', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'ImageNode',
          display_name: 'Image Node',
          input: { required: { image: ['IMAGE', {}] } }
        })
      ])

      await createRender({
        filters: [
          {
            filterDef: useNodeDefStore().nodeSearchService.inputTypeFilter,
            value: 'IMAGE'
          }
        ]
      })

      expect(screen.getAllByTestId('filter-chip').length).toBeGreaterThan(0)
    })
  })

  describe('chip removal', () => {
    function createFilters(count: number) {
      const types = ['IMAGE', 'LATENT', 'MODEL']
      useNodeDefStore().updateNodeDefs(
        types.slice(0, count).map((type) =>
          createMockNodeDef({
            name: `${type}Node`,
            display_name: `${type} Node`,
            input: {
              required: { [type.toLowerCase()]: [type, {}] }
            }
          })
        )
      )
      return types.slice(0, count).map((type) => ({
        filterDef: useNodeDefStore().nodeSearchService.inputTypeFilter,
        value: type
      }))
    }

    it('should emit removeFilter on backspace', async () => {
      const filters = createFilters(1)
      const { user, onRemoveFilter } = await createRender({ filters })

      await user.click(screen.getByRole('combobox'))
      await user.keyboard('{Backspace}')
      await nextTick()
      await user.keyboard('{Backspace}')
      await nextTick()

      expect(onRemoveFilter).toHaveBeenCalledTimes(1)
      expect(onRemoveFilter).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'IMAGE' })
      )
    })

    it('should not interact with chips when no filters exist', async () => {
      const { user, onRemoveFilter } = await createRender({ filters: [] })

      await user.click(screen.getByRole('combobox'))
      await user.keyboard('{Backspace}')
      await nextTick()

      expect(onRemoveFilter).not.toHaveBeenCalled()
    })

    it('should remove chip when clicking its delete button', async () => {
      const filters = createFilters(1)
      const { user, onRemoveFilter } = await createRender({ filters })

      await user.click(screen.getByTestId('chip-delete'))
      await nextTick()

      expect(onRemoveFilter).toHaveBeenCalledTimes(1)
      expect(onRemoveFilter).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'IMAGE' })
      )
    })
  })

  describe('filter selection mode', () => {
    function setupNodesWithTypes() {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'ImageNode',
          display_name: 'Image Node',
          input: { required: { image: ['IMAGE', {}] } },
          output: ['IMAGE']
        }),
        createMockNodeDef({
          name: 'LatentNode',
          display_name: 'Latent Node',
          input: { required: { latent: ['LATENT', {}] } },
          output: ['LATENT']
        }),
        createMockNodeDef({
          name: 'ModelNode',
          display_name: 'Model Node',
          input: { required: { model: ['MODEL', {}] } },
          output: ['MODEL']
        })
      ])
    }

    function findFilterBarButton(label: string) {
      return screen.getAllByRole('button').find((b) => b.textContent === label)
    }

    async function enterFilterMode(user: ReturnType<typeof userEvent.setup>) {
      const btn = findFilterBarButton('Input')
      expect(btn).toBeDefined()
      await user.click(btn!)
      await nextTick()
    }

    function hasSidebar() {
      return screen.queryByTestId('category-most-relevant') !== null
    }

    it('should enter filter mode when a filter chip is selected', async () => {
      setupNodesWithTypes()
      const { user } = await createRender()

      expect(hasSidebar()).toBe(true)

      await enterFilterMode(user)

      expect(hasSidebar()).toBe(false)
      expect(screen.getAllByTestId('filter-option').length).toBeGreaterThan(0)
    })

    it('should show available filter options sorted alphabetically', async () => {
      setupNodesWithTypes()
      const { user } = await createRender()
      await enterFilterMode(user)

      const texts = screen.getAllByTestId('filter-option').map(
        (o) =>
          /* eslint-disable testing-library/no-node-access */
          (o.querySelectorAll('span')[0] as HTMLElement)?.textContent
            ?.replace(/^[•·]\s*/, '')
            .trim() ?? ''
        /* eslint-enable testing-library/no-node-access */
      )
      expect(texts).toContain('IMAGE')
      expect(texts).toContain('LATENT')
      expect(texts).toContain('MODEL')
      expect(texts).toEqual([...texts].sort())
    })

    it('should filter options when typing in filter mode', async () => {
      setupNodesWithTypes()
      const { user } = await createRender()
      await enterFilterMode(user)

      await user.type(screen.getByRole('combobox'), 'IMAGE')
      await nextTick()

      const texts = screen.getAllByTestId('filter-option').map(
        (o) =>
          /* eslint-disable testing-library/no-node-access */
          (o.querySelectorAll('span')[0] as HTMLElement)?.textContent
            ?.replace(/^[•·]\s*/, '')
            .trim() ?? ''
        /* eslint-enable testing-library/no-node-access */
      )
      expect(texts).toContain('IMAGE')
      expect(texts).not.toContain('MODEL')
    })

    it('should show no results when filter query has no matches', async () => {
      setupNodesWithTypes()
      const { user } = await createRender()
      await enterFilterMode(user)

      await user.type(screen.getByRole('combobox'), 'NONEXISTENT_TYPE')
      await nextTick()

      expect(screen.getByText('No results')).toBeInTheDocument()
    })

    it('should emit addFilter when a filter option is clicked', async () => {
      setupNodesWithTypes()
      const { user, onAddFilter } = await createRender()
      await enterFilterMode(user)

      const imageOption = screen
        .getAllByTestId('filter-option')
        .find((o) => o.textContent?.includes('IMAGE'))
      await user.click(imageOption!)
      await nextTick()

      expect(onAddFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          filterDef: expect.objectContaining({ id: 'input' }),
          value: 'IMAGE'
        })
      )
    })

    it('should exit filter mode after applying a filter', async () => {
      setupNodesWithTypes()
      const { user } = await createRender()
      await enterFilterMode(user)

      await user.click(screen.getAllByTestId('filter-option')[0])
      await nextTick()
      await nextTick()

      expect(hasSidebar()).toBe(true)
    })

    it('should emit addFilter when Enter is pressed on selected option', async () => {
      setupNodesWithTypes()
      const { user, onAddFilter } = await createRender()
      await enterFilterMode(user)

      await user.click(screen.getByRole('combobox'))
      await user.keyboard('{Enter}')
      await nextTick()

      expect(onAddFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          filterDef: expect.objectContaining({ id: 'input' }),
          value: 'IMAGE'
        })
      )
    })

    it('should navigate filter options with ArrowDown/ArrowUp', async () => {
      setupNodesWithTypes()
      const { user } = await createRender()
      await enterFilterMode(user)

      await user.click(screen.getByRole('combobox'))

      expect(screen.getAllByTestId('filter-option')[0]).toHaveAttribute(
        'aria-selected',
        'true'
      )

      await user.keyboard('{ArrowDown}')
      await nextTick()
      expect(screen.getAllByTestId('filter-option')[1]).toHaveAttribute(
        'aria-selected',
        'true'
      )

      await user.keyboard('{ArrowUp}')
      await nextTick()
      expect(screen.getAllByTestId('filter-option')[0]).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })

    it('should toggle filter mode off when same chip is clicked again', async () => {
      setupNodesWithTypes()
      const { user } = await createRender()
      await enterFilterMode(user)

      await user.click(findFilterBarButton('Input')!)
      await nextTick()
      await nextTick()

      expect(hasSidebar()).toBe(true)
    })

    it('should reset filter query when re-entering filter mode', async () => {
      setupNodesWithTypes()
      const { user } = await createRender()
      await enterFilterMode(user)

      const input = screen.getByRole('combobox')
      await user.type(input, 'IMAGE')
      await nextTick()

      await user.click(findFilterBarButton('Input')!)
      await nextTick()
      await nextTick()

      await enterFilterMode(user)

      expect(input).toHaveValue('')
    })

    it('should exit filter mode when cancel button is clicked', async () => {
      setupNodesWithTypes()
      const { user } = await createRender()
      await enterFilterMode(user)

      expect(hasSidebar()).toBe(false)

      await user.click(screen.getByTestId('cancel-filter'))
      await nextTick()
      await nextTick()

      expect(hasSidebar()).toBe(true)
    })
  })
})
