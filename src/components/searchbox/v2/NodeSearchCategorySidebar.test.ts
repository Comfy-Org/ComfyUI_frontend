import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeSearchCategorySidebar from '@/components/searchbox/v2/NodeSearchCategorySidebar.vue'
import {
  createMockNodeDef,
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import { useNodeDefStore } from '@/stores/nodeDefStore'

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

describe('NodeSearchCategorySidebar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setupTestPinia()
  })

  async function createRender(props = {}) {
    const user = userEvent.setup()
    const onUpdateSelectedCategory = vi.fn()
    const baseProps = { selectedCategory: 'most-relevant', ...props }

    let currentProps = { ...baseProps }
    let rerenderFn: (
      p: typeof baseProps & Record<string, unknown>
    ) => void = () => {}

    function makeProps(overrides = {}) {
      const merged = { ...currentProps, ...overrides }
      return {
        ...merged,
        'onUpdate:selectedCategory': (val: string) => {
          onUpdateSelectedCategory(val)
          currentProps = { ...currentProps, selectedCategory: val }
          rerenderFn(makeProps())
        }
      }
    }

    const result = render(NodeSearchCategorySidebar, {
      props: makeProps(),
      global: { plugins: [testI18n] }
    })
    rerenderFn = (p) => result.rerender(p)
    await nextTick()
    return { user, onUpdateSelectedCategory }
  }

  async function clickCategory(
    user: ReturnType<typeof userEvent.setup>,
    text: string,
    exact = false
  ) {
    const candidates = [
      ...screen.queryAllByRole('button'),
      ...screen.queryAllByRole('treeitem')
    ]
    const btn = candidates.find((b) =>
      exact ? b.textContent?.trim() === text : b.textContent?.includes(text)
    )
    expect(btn, `Expected to find a button with text "${text}"`).toBeDefined()
    await user.click(btn!)
    await nextTick()
  }

  describe('preset categories', () => {
    it('should render Most relevant preset category', async () => {
      await createRender()

      expect(screen.getByText('Most relevant')).toBeInTheDocument()
    })

    it('should mark the selected preset category as selected', async () => {
      await createRender({ selectedCategory: 'most-relevant' })

      expect(screen.getByTestId('category-most-relevant')).toHaveAttribute(
        'aria-current',
        'true'
      )
    })

    it('should emit update:selectedCategory when preset is clicked', async () => {
      const { user, onUpdateSelectedCategory } = await createRender({
        selectedCategory: 'most-relevant'
      })

      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' })
      ])
      await nextTick()

      await clickCategory(user, 'sampling')

      expect(onUpdateSelectedCategory).toHaveBeenCalledWith('sampling')
    })
  })

  describe('category tree', () => {
    it('should render top-level categories from node definitions', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'loaders' }),
        createMockNodeDef({ name: 'Node3', category: 'conditioning' })
      ])
      await nextTick()

      await createRender()

      expect(screen.getByText('sampling')).toBeInTheDocument()
      expect(screen.getByText('loaders')).toBeInTheDocument()
      expect(screen.getByText('conditioning')).toBeInTheDocument()
    })

    it('should emit update:selectedCategory when category is clicked', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' })
      ])
      await nextTick()

      const { user, onUpdateSelectedCategory } = await createRender()

      await clickCategory(user, 'sampling')

      expect(onUpdateSelectedCategory).toHaveBeenCalledWith('sampling')
    })
  })

  describe('expand/collapse functionality', () => {
    it('should expand category when clicked and show subcategories', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'sampling/basic' }),
        createMockNodeDef({ name: 'Node4', category: 'loaders' })
      ])
      await nextTick()

      const { user } = await createRender()

      expect(screen.queryByText('advanced')).not.toBeInTheDocument()

      await clickCategory(user, 'sampling')

      await waitFor(() => {
        expect(screen.getByText('advanced')).toBeInTheDocument()
        expect(screen.getByText('basic')).toBeInTheDocument()
      })
    })

    it('should collapse sibling category when another is expanded', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'image' }),
        createMockNodeDef({ name: 'Node4', category: 'image/upscale' })
      ])
      await nextTick()

      const { user } = await createRender()

      // Expand sampling
      await clickCategory(user, 'sampling', true)
      await waitFor(() => {
        expect(screen.getByText('advanced')).toBeInTheDocument()
      })

      // Expand image — sampling should collapse
      await clickCategory(user, 'image', true)

      await waitFor(() => {
        expect(screen.getByText('upscale')).toBeInTheDocument()
        expect(screen.queryByText('advanced')).not.toBeInTheDocument()
      })
    })

    it('should emit update:selectedCategory when subcategory is clicked', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const { user, onUpdateSelectedCategory } = await createRender()

      // Expand sampling category
      await clickCategory(user, 'sampling', true)
      await waitFor(() => {
        expect(screen.getByText('advanced')).toBeInTheDocument()
      })

      // Click on advanced subcategory
      await clickCategory(user, 'advanced')

      const calls = onUpdateSelectedCategory.mock.calls
      expect(calls[calls.length - 1]).toEqual(['sampling/advanced'])
    })
  })

  describe('category selection highlighting', () => {
    it('should mark selected top-level category as selected', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' })
      ])
      await nextTick()

      await createRender({ selectedCategory: 'sampling' })

      expect(screen.getByTestId('category-sampling')).toHaveAttribute(
        'aria-current',
        'true'
      )
    })

    it('should emit selected subcategory when expanded', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const { user, onUpdateSelectedCategory } = await createRender({
        selectedCategory: 'most-relevant'
      })

      // Expand and click subcategory
      await clickCategory(user, 'sampling', true)
      await waitFor(() => {
        expect(screen.getByText('advanced')).toBeInTheDocument()
      })
      await clickCategory(user, 'advanced')

      const calls = onUpdateSelectedCategory.mock.calls
      expect(calls[calls.length - 1]).toEqual(['sampling/advanced'])
    })
  })

  describe('hidePresets prop', () => {
    it('should hide preset categories when hidePresets is true', async () => {
      await createRender({ hidePresets: true })

      expect(screen.queryByText('Most relevant')).not.toBeInTheDocument()
    })
  })

  it('should emit category without root/ prefix', async () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({ name: 'Node1', category: 'sampling' })
    ])
    await nextTick()

    const { user, onUpdateSelectedCategory } = await createRender()

    await clickCategory(user, 'sampling')

    expect(onUpdateSelectedCategory).toHaveBeenCalledWith('sampling')
  })

  it('should emit autoExpand when there is a single root category', async () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({ name: 'Node1', category: 'api' }),
      createMockNodeDef({ name: 'Node2', category: 'api/image' })
    ])
    await nextTick()

    const onAutoExpand = vi.fn()
    render(NodeSearchCategorySidebar, {
      props: {
        selectedCategory: 'most-relevant',
        onAutoExpand: onAutoExpand
      },
      global: { plugins: [testI18n] }
    })
    await nextTick()

    expect(onAutoExpand).toHaveBeenCalledWith('api')
  })

  it('should support deeply nested categories', async () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({ name: 'Node1', category: 'api' }),
      createMockNodeDef({ name: 'Node2', category: 'api/image' }),
      createMockNodeDef({ name: 'Node3', category: 'api/image/BFL' })
    ])
    await nextTick()

    const { user, onUpdateSelectedCategory } = await createRender()

    // Only top-level visible initially
    expect(screen.getByText('api')).toBeInTheDocument()
    expect(screen.queryByText('image')).not.toBeInTheDocument()
    expect(screen.queryByText('BFL')).not.toBeInTheDocument()

    // Expand api
    await clickCategory(user, 'api', true)
    await waitFor(() => {
      expect(screen.getByText('image')).toBeInTheDocument()
    })
    expect(screen.queryByText('BFL')).not.toBeInTheDocument()

    // Expand image
    await clickCategory(user, 'image', true)
    await waitFor(() => {
      expect(screen.getByText('BFL')).toBeInTheDocument()
    })

    // Click BFL and verify emission
    await clickCategory(user, 'BFL', true)

    const calls = onUpdateSelectedCategory.mock.calls
    expect(calls[calls.length - 1]).toEqual(['api/image/BFL'])
  })

  describe('keyboard navigation', () => {
    it('should expand a collapsed tree node on ArrowRight', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const { user, onUpdateSelectedCategory } = await createRender()

      expect(screen.queryByText('advanced')).not.toBeInTheDocument()

      const samplingBtn = screen.getByTestId('category-sampling')
      samplingBtn.focus()
      await user.keyboard('{ArrowRight}')
      await nextTick()

      // Should have emitted select for sampling, expanding it
      expect(onUpdateSelectedCategory).toHaveBeenCalledWith('sampling')
    })

    it('should collapse an expanded tree node on ArrowLeft', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const { user } = await createRender()

      // First expand sampling by clicking
      await clickCategory(user, 'sampling', true)
      await waitFor(() => {
        expect(screen.getByText('advanced')).toBeInTheDocument()
      })

      const samplingBtn = screen.getByTestId('category-sampling')
      samplingBtn.focus()
      await user.keyboard('{ArrowLeft}')
      await nextTick()

      // Collapse toggles internal state; children should be hidden
      expect(screen.queryByText('advanced')).not.toBeInTheDocument()
    })

    it('should focus first child on ArrowRight when already expanded', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const { user } = await createRender()
      await clickCategory(user, 'sampling', true)
      await waitFor(() => {
        expect(screen.getByText('advanced')).toBeInTheDocument()
      })

      const samplingBtn = screen.getByTestId('category-sampling')
      samplingBtn.focus()
      await user.keyboard('{ArrowRight}')
      await nextTick()

      expect(screen.getByTestId('category-sampling/advanced')).toHaveFocus()
    })

    it('should focus parent on ArrowLeft from a leaf or collapsed node', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const { user } = await createRender()
      await clickCategory(user, 'sampling', true)
      await waitFor(() => {
        expect(screen.getByText('advanced')).toBeInTheDocument()
      })

      screen.getByTestId('category-sampling/advanced').focus()
      await user.keyboard('{ArrowLeft}')
      await nextTick()

      expect(screen.getByTestId('category-sampling')).toHaveFocus()
    })

    it('should collapse sampling on ArrowLeft, not just its expanded child', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({
          name: 'Node2',
          category: 'sampling/custom_sampling'
        }),
        createMockNodeDef({
          name: 'Node3',
          category: 'sampling/custom_sampling/child'
        }),
        createMockNodeDef({ name: 'Node4', category: 'loaders' })
      ])
      await nextTick()

      const { user } = await createRender()

      // Step 1: Expand sampling
      await clickCategory(user, 'sampling', true)
      await waitFor(() => {
        expect(screen.getByText('custom_sampling')).toBeInTheDocument()
      })

      // Step 2: Expand custom_sampling
      await clickCategory(user, 'custom_sampling', true)
      await waitFor(() => {
        expect(screen.getByText('child')).toBeInTheDocument()
      })

      // Step 3: Navigate back to sampling (keyboard focus only)
      const samplingBtn = screen.getByTestId('category-sampling')
      samplingBtn.focus()
      await nextTick()

      // Step 4: Press left on sampling
      await user.keyboard('{ArrowLeft}')
      await nextTick()

      // Sampling should collapse entirely — custom_sampling should not be visible
      expect(screen.queryByText('custom_sampling')).not.toBeInTheDocument()
    })

    it('should collapse 4-deep tree to parent of level 2 on ArrowLeft', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'N1', category: 'a' }),
        createMockNodeDef({ name: 'N2', category: 'a/b' }),
        createMockNodeDef({ name: 'N3', category: 'a/b/c' }),
        createMockNodeDef({ name: 'N4', category: 'a/b/c/d' }),
        createMockNodeDef({ name: 'N5', category: 'other' })
      ])
      await nextTick()

      const { user } = await createRender()

      // Expand a → a/b → a/b/c
      await clickCategory(user, 'a', true)
      await waitFor(() => {
        expect(screen.getByText('b')).toBeInTheDocument()
      })

      await clickCategory(user, 'b', true)
      await waitFor(() => {
        expect(screen.getByText('c')).toBeInTheDocument()
      })

      await clickCategory(user, 'c', true)
      await waitFor(() => {
        expect(screen.getByText('d')).toBeInTheDocument()
      })

      // Focus level 2 (a/b) and press ArrowLeft
      const bBtn = screen.getByTestId('category-a/b')
      bBtn.focus()
      await nextTick()

      await user.keyboard('{ArrowLeft}')
      await nextTick()

      // Level 2 and below should collapse, but level 1 (a) stays expanded
      // so 'b' is still visible but 'c' and 'd' are not
      expect(screen.getByText('b')).toBeInTheDocument()
      expect(screen.queryByText('c')).not.toBeInTheDocument()
      expect(screen.queryByText('d')).not.toBeInTheDocument()
    })

    it('should set aria-expanded on tree nodes with children', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      await createRender()

      expect(screen.getByTestId('category-sampling')).toHaveAttribute(
        'aria-expanded',
        'false'
      )

      // Leaf node should not have aria-expanded
      expect(screen.getByTestId('category-loaders')).not.toHaveAttribute(
        'aria-expanded'
      )
    })
  })
})
