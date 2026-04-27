import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import NodeSearchContent from '@/components/searchbox/v2/NodeSearchContent.vue'
import {
  createMockNodeDef,
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'

describe('NodeSearchContent', () => {
  beforeEach(() => {
    setupTestPinia()
    vi.restoreAllMocks()
    const settings = useSettingStore()
    settings.settingValues['Comfy.NodeLibrary.Bookmarks.V2'] = []
    settings.settingValues['Comfy.NodeLibrary.BookmarksCustomization'] = {}
  })

  function renderComponent(props = {}) {
    const user = userEvent.setup()
    const onAddNode = vi.fn()
    const onHoverNode = vi.fn()
    const onRemoveFilter =
      vi.fn<(f: FuseFilterWithValue<ComfyNodeDefImpl, string>) => void>()
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
    return { user, onAddNode, onHoverNode, onRemoveFilter, onAddFilter }
  }

  function mockBookmarks(
    isBookmarked: boolean | ((node: ComfyNodeDefImpl) => boolean) = true,
    bookmarkList: string[] = []
  ) {
    const bookmarkStore = useNodeBookmarkStore()
    if (typeof isBookmarked === 'function') {
      vi.spyOn(bookmarkStore, 'isBookmarked').mockImplementation(isBookmarked)
    } else {
      vi.spyOn(bookmarkStore, 'isBookmarked').mockReturnValue(isBookmarked)
    }
    vi.spyOn(bookmarkStore, 'bookmarks', 'get').mockReturnValue(bookmarkList)
  }

  function clickFilterBarButton(
    user: ReturnType<typeof userEvent.setup>,
    text: string
  ) {
    const btn = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === text)
    expect(btn, `Expected filter button "${text}"`).toBeDefined()
    return user.click(btn!)
  }

  async function setupFavorites(
    nodes: Parameters<typeof createMockNodeDef>[0][]
  ) {
    useNodeDefStore().updateNodeDefs(nodes.map(createMockNodeDef))
    mockBookmarks(true, ['placeholder'])
    const result = renderComponent()
    await clickFilterBarButton(result.user, 'Bookmarked')
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

      renderComponent()

      await waitFor(() => {
        const items = screen.getAllByTestId('node-item')
        expect(items).toHaveLength(1)
        expect(items[0]).toHaveTextContent('Frequent Node')
      })
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
      mockBookmarks(
        (node: ComfyNodeDefImpl) => node.name === 'BookmarkedNode',
        ['BookmarkedNode']
      )

      const { user } = renderComponent()
      await clickFilterBarButton(user, 'Bookmarked')

      await waitFor(() => {
        const items = screen.getAllByTestId('node-item')
        expect(items).toHaveLength(1)
        expect(items[0]).toHaveTextContent('Bookmarked')
      })
    })

    it('should show empty state when no bookmarks exist', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', display_name: 'Node One' })
      ])
      mockBookmarks(false, ['placeholder'])

      const { user } = renderComponent()
      await clickFilterBarButton(user, 'Bookmarked')

      expect(await screen.findByText('No Results')).toBeInTheDocument()
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

      expect(useNodeDefStore().nodeDefsByName['CoreNode'].nodeSource.type).toBe(
        NodeSourceType.Core
      )
      expect(
        useNodeDefStore().nodeDefsByName['CustomNode'].nodeSource.type
      ).toBe(NodeSourceType.CustomNodes)

      const { user } = renderComponent()
      await clickFilterBarButton(user, 'Extensions')

      await waitFor(() => {
        const items = screen.getAllByTestId('node-item')
        expect(items).toHaveLength(1)
        expect(items[0]).toHaveTextContent('Custom Node')
      })
    })

    it('should hide Essentials filter button when no essential nodes exist', () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'RegularNode',
          display_name: 'Regular Node'
        })
      ])

      renderComponent()
      const texts = screen
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())
      expect(texts).not.toContain('Essentials')
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

      const { user } = renderComponent()
      await clickFilterBarButton(user, 'Essentials')

      await waitFor(() => {
        const items = screen.getAllByTestId('node-item')
        expect(items).toHaveLength(1)
        expect(items[0]).toHaveTextContent('Essential Node')
      })
    })

    it('should show only API nodes when Partner Nodes filter is active', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'ApiNode',
          display_name: 'API Node',
          api_node: true
        }),
        createMockNodeDef({
          name: 'RegularNode',
          display_name: 'Regular Node'
        })
      ])

      const { user } = renderComponent()
      await clickFilterBarButton(user, 'Partner')

      await waitFor(() => {
        const items = screen.getAllByTestId('node-item')
        expect(items).toHaveLength(1)
        expect(items[0]).toHaveTextContent('API Node')
      })
    })

    it('should toggle filter off when clicking the active filter button again', async () => {
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

      vi.spyOn(useNodeFrequencyStore(), 'topNodeDefs', 'get').mockReturnValue([
        useNodeDefStore().nodeDefsByName['CoreNode'],
        useNodeDefStore().nodeDefsByName['CustomNode']
      ])

      const { user } = renderComponent()

      await clickFilterBarButton(user, 'Extensions')
      await waitFor(() => {
        expect(screen.getAllByTestId('node-item')).toHaveLength(1)
      })

      await clickFilterBarButton(user, 'Extensions')
      await waitFor(() => {
        expect(screen.getAllByTestId('node-item')).toHaveLength(2)
      })
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

      const { user } = renderComponent()
      await user.click(await screen.findByTestId('category-sampling'))

      await waitFor(() => {
        expect(screen.getAllByTestId('node-item')).toHaveLength(2)
      })
      const texts = screen.getAllByTestId('node-item').map((i) => i.textContent)
      expect(texts).toContain('KSampler')
      expect(texts).toContain('KSampler Advanced')
    })
  })

  describe('search and category interaction', () => {
    it('should search within selected category', async () => {
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

      const { user } = renderComponent()
      await user.click(await screen.findByTestId('category-sampling'))

      await waitFor(() => {
        expect(screen.getAllByTestId('node-item')).toHaveLength(1)
      })

      const input = screen.getByRole('combobox')
      await user.type(input, 'Load')

      await waitFor(() => {
        const texts = screen
          .queryAllByTestId('node-item')
          .map((i) => i.textContent)
        expect(texts.some((t) => t?.includes('Load Checkpoint'))).toBe(false)
      })
    })

    it('should preserve search query when category changes', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'TestNode', display_name: 'Test Node' })
      ])
      mockBookmarks(true, ['placeholder'])

      const { user } = renderComponent()

      const input = screen.getByRole('combobox')
      await user.type(input, 'test query')
      expect(input).toHaveValue('test query')

      await clickFilterBarButton(user, 'Bookmarked')
      expect(input).toHaveValue('test query')
    })

    it('should reset selected index when search query changes', async () => {
      const { user } = await setupFavorites([
        { name: 'Node1', display_name: 'Node One' },
        { name: 'Node2', display_name: 'Node Two' }
      ])

      const input = screen.getByRole('combobox')
      await user.click(input)
      await user.keyboard('{ArrowDown}')
      await waitFor(() => {
        expect(screen.getAllByTestId('result-item')[1]).toHaveAttribute(
          'aria-selected',
          'true'
        )
      })

      await user.type(input, 'Node')
      await waitFor(() => {
        expect(screen.getAllByTestId('result-item')[0]).toHaveAttribute(
          'aria-selected',
          'true'
        )
      })
    })

    it('should reset selected index when category changes', async () => {
      const { user } = await setupFavorites([
        { name: 'Node1', display_name: 'Node One' },
        { name: 'Node2', display_name: 'Node Two' }
      ])

      await user.click(screen.getByRole('combobox'))
      await user.keyboard('{ArrowDown}')

      await clickFilterBarButton(user, 'Bookmarked')
      await clickFilterBarButton(user, 'Bookmarked')

      await waitFor(() => {
        expect(screen.getAllByTestId('result-item')[0]).toHaveAttribute(
          'aria-selected',
          'true'
        )
      })
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
      await waitFor(() => expect(selectedIndex()).toBe(1))

      await user.keyboard('{ArrowDown}')
      await waitFor(() => expect(selectedIndex()).toBe(2))

      await user.keyboard('{ArrowUp}')
      await waitFor(() => expect(selectedIndex()).toBe(1))

      // Navigate to first, then try going above — should clamp
      await user.keyboard('{ArrowUp}')
      await waitFor(() => expect(selectedIndex()).toBe(0))

      await user.keyboard('{ArrowUp}')
      expect(selectedIndex()).toBe(0)
    })

    it('should select current result with Enter key', async () => {
      const { user, onAddNode } = await setupFavorites([
        { name: 'TestNode', display_name: 'Test Node' }
      ])

      await user.click(screen.getByRole('combobox'))
      await user.keyboard('{Enter}')

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

      await waitFor(() => {
        expect(results[1]).toHaveAttribute('aria-selected', 'true')
      })
    })

    it('should add node on click', async () => {
      const { user, onAddNode } = await setupFavorites([
        { name: 'TestNode', display_name: 'Test Node' }
      ])

      await user.click(screen.getAllByTestId('result-item')[0])

      expect(onAddNode).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestNode' }),
        expect.any(PointerEvent)
      )
    })

    it('should navigate results with ArrowDown/ArrowUp from a focused result item', async () => {
      const { user } = await setupFavorites([
        { name: 'Node1', display_name: 'Node One' },
        { name: 'Node2', display_name: 'Node Two' },
        { name: 'Node3', display_name: 'Node Three' }
      ])

      const results = screen.getAllByTestId('result-item')
      results[0].focus()
      await user.keyboard('{ArrowDown}')

      await waitFor(() => {
        expect(screen.getAllByTestId('result-item')[1]).toHaveAttribute(
          'aria-selected',
          'true'
        )
      })

      screen.getAllByTestId('result-item')[1].focus()
      await user.keyboard('{ArrowDown}')

      await waitFor(() => {
        expect(screen.getAllByTestId('result-item')[2]).toHaveAttribute(
          'aria-selected',
          'true'
        )
      })
    })

    it('should select node with Enter from a focused result item', async () => {
      const { user, onAddNode } = await setupFavorites([
        { name: 'TestNode', display_name: 'Test Node' }
      ])

      screen.getAllByTestId('result-item')[0].focus()
      await user.keyboard('{Enter}')

      expect(onAddNode).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestNode' })
      )
    })
  })

  describe('hoverNode emission', () => {
    it('should emit hoverNode with the currently selected node', async () => {
      const { onHoverNode } = await setupFavorites([
        { name: 'HoverNode', display_name: 'Hover Node' }
      ])

      await waitFor(() => {
        const calls = onHoverNode.mock.calls
        expect(calls[calls.length - 1][0]).toMatchObject({ name: 'HoverNode' })
      })
    })

    it('should emit null hoverNode when no results', async () => {
      mockBookmarks(false, ['placeholder'])
      const { user, onHoverNode } = renderComponent()

      await clickFilterBarButton(user, 'Bookmarked')

      await waitFor(() => {
        const calls = onHoverNode.mock.calls
        expect(calls[calls.length - 1][0]).toBeNull()
      })
    })
  })

  describe('filter integration', () => {
    it('should display active filters in the input area', () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'ImageNode',
          display_name: 'Image Node',
          input: { required: { image: ['IMAGE', {}] } }
        })
      ])

      renderComponent({
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
      const { user, onRemoveFilter } = renderComponent({ filters })

      await user.click(screen.getByRole('combobox'))
      await user.keyboard('{Backspace}')
      await user.keyboard('{Backspace}')

      expect(onRemoveFilter).toHaveBeenCalledTimes(1)
      expect(onRemoveFilter).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'IMAGE' })
      )
    })

    it('should not interact with chips when no filters exist', async () => {
      const { user, onRemoveFilter } = renderComponent({ filters: [] })

      await user.click(screen.getByRole('combobox'))
      await user.keyboard('{Backspace}')

      expect(onRemoveFilter).not.toHaveBeenCalled()
    })

    it('should remove chip when clicking its delete button', async () => {
      const filters = createFilters(1)
      const { user, onRemoveFilter } = renderComponent({ filters })

      await user.click(screen.getByTestId('chip-delete'))

      expect(onRemoveFilter).toHaveBeenCalledTimes(1)
      expect(onRemoveFilter).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'IMAGE' })
      )
    })

    it('should emit removeFilter for every filter in a group when cleared', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'ImageNode',
          display_name: 'Image Node',
          input: { required: { image: ['IMAGE', {}] } }
        }),
        createMockNodeDef({
          name: 'LatentNode',
          display_name: 'Latent Node',
          input: { required: { latent: ['LATENT', {}] } }
        })
      ])
      const inputFilter = useNodeDefStore().nodeSearchService.inputTypeFilter
      const filters = [
        { filterDef: inputFilter, value: 'IMAGE' },
        { filterDef: inputFilter, value: 'LATENT' }
      ]

      const { user, onRemoveFilter } = renderComponent({ filters })

      const inputBtn = screen.getByRole('button', { name: /Input/ })
      await user.click(inputBtn)

      const clearBtn = await screen.findByRole('button', { name: 'Clear all' })
      await user.click(clearBtn)

      await waitFor(() => {
        expect(onRemoveFilter).toHaveBeenCalledTimes(2)
      })
      const removedValues = onRemoveFilter.mock.calls.map(([f]) => f.value)
      expect(removedValues).toEqual(expect.arrayContaining(['IMAGE', 'LATENT']))
    })
  })

  describe('rootFilter + category + search combination', () => {
    it('should intersect rootFilter, selected category, and search query', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'CustomSampler',
          display_name: 'Custom Sampler',
          category: 'sampling',
          python_module: 'custom_nodes.my_extension'
        }),
        createMockNodeDef({
          name: 'CustomLoader',
          display_name: 'Custom Loader',
          category: 'loaders',
          python_module: 'custom_nodes.my_extension'
        }),
        createMockNodeDef({
          name: 'CoreSampler',
          display_name: 'Core Sampler',
          category: 'sampling',
          python_module: 'nodes'
        })
      ])

      const { user } = renderComponent()

      await clickFilterBarButton(user, 'Extensions')
      const samplingBtn = await screen.findByTestId('category-custom/sampling')
      await user.click(samplingBtn)

      const input = screen.getByRole('combobox')
      await user.type(input, 'Custom')

      await waitFor(() => {
        expect(screen.queryAllByTestId('node-item')).toHaveLength(1)
      })
      const texts = screen
        .queryAllByTestId('node-item')
        .map((i) => i.textContent)
      expect(texts).toContain('Custom Sampler')
      expect(texts).not.toContain('Core Sampler')
      expect(texts).not.toContain('Custom Loader')
    })
  })
})
