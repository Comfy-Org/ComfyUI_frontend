import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import NodeSearchCategorySidebar from '@/components/searchbox/v2/NodeSearchCategorySidebar.vue'
import {
  createMockNodeDef,
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import { useNodeDefStore } from '@/stores/nodeDefStore'

type SidebarProps = Partial<{
  selectedCategory: string
  hidePresets: boolean
  rootLabel: string
  rootKey: string
}>

describe('NodeSearchCategorySidebar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setupTestPinia()
  })

  function createRender(props: SidebarProps = {}) {
    const user = userEvent.setup()
    const onUpdateSelectedCategory = vi.fn<(value: string) => void>()
    const initialProps: SidebarProps & { selectedCategory: string } = {
      selectedCategory: 'most-relevant',
      ...props
    }

    const result = render(NodeSearchCategorySidebar, {
      props: {
        ...initialProps,
        'onUpdate:selectedCategory': onUpdateSelectedCategory
      },
      global: { plugins: [testI18n] }
    })

    const rerender = (overrides: SidebarProps) =>
      result.rerender({
        ...initialProps,
        ...overrides,
        'onUpdate:selectedCategory': onUpdateSelectedCategory
      })

    return { user, onUpdateSelectedCategory, rerender }
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
  }

  describe('preset categories', () => {
    it('should render Most relevant preset category', () => {
      createRender()

      expect(screen.getByText('Most relevant')).toBeInTheDocument()
    })

    it('should mark the selected preset category as selected', () => {
      createRender({ selectedCategory: 'most-relevant' })

      expect(screen.getByTestId('category-most-relevant')).toHaveAttribute(
        'aria-current',
        'true'
      )
    })

    it('should emit update:selectedCategory when preset is clicked', async () => {
      const { user, onUpdateSelectedCategory } = createRender({
        selectedCategory: 'most-relevant'
      })

      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' })
      ])

      await screen.findByText('sampling')
      await clickCategory(user, 'sampling')

      expect(onUpdateSelectedCategory).toHaveBeenCalledWith('sampling')
    })
  })

  describe('category tree', () => {
    it('should render top-level categories from node definitions', () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'loaders' }),
        createMockNodeDef({ name: 'Node3', category: 'conditioning' })
      ])

      createRender()

      expect(screen.getByText('sampling')).toBeInTheDocument()
      expect(screen.getByText('loaders')).toBeInTheDocument()
      expect(screen.getByText('conditioning')).toBeInTheDocument()
    })

    it('should emit update:selectedCategory when category is clicked', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' })
      ])

      const { user, onUpdateSelectedCategory } = createRender()

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

      const { user } = createRender()

      expect(screen.queryByText('advanced')).not.toBeInTheDocument()

      await clickCategory(user, 'sampling')

      await screen.findByText('advanced')
      expect(screen.getByText('basic')).toBeInTheDocument()
    })

    it('should collapse sibling category when another is expanded', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'image' }),
        createMockNodeDef({ name: 'Node4', category: 'image/upscale' })
      ])

      const { user } = createRender()

      // Expand sampling
      await clickCategory(user, 'sampling', true)
      await screen.findByText('advanced')

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

      const { user, onUpdateSelectedCategory } = createRender()

      // Expand sampling category
      await clickCategory(user, 'sampling', true)
      await screen.findByText('advanced')

      // Click on advanced subcategory
      await clickCategory(user, 'advanced')

      const calls = onUpdateSelectedCategory.mock.calls
      expect(calls[calls.length - 1]).toEqual(['sampling/advanced'])
    })
  })

  describe('category selection highlighting', () => {
    it('should mark selected top-level category as selected', () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' })
      ])

      createRender({ selectedCategory: 'sampling' })

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

      const { user, onUpdateSelectedCategory } = createRender({
        selectedCategory: 'most-relevant'
      })

      // Expand and click subcategory
      await clickCategory(user, 'sampling', true)
      await screen.findByText('advanced')
      await clickCategory(user, 'advanced')

      const calls = onUpdateSelectedCategory.mock.calls
      expect(calls[calls.length - 1]).toEqual(['sampling/advanced'])
    })
  })

  describe('hidePresets prop', () => {
    it('should hide preset categories when hidePresets is true', () => {
      createRender({ hidePresets: true })

      expect(screen.queryByText('Most relevant')).not.toBeInTheDocument()
    })
  })

  it('should emit category without root/ prefix', async () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({ name: 'Node1', category: 'sampling' })
    ])

    const { user, onUpdateSelectedCategory } = createRender()

    await clickCategory(user, 'sampling')

    expect(onUpdateSelectedCategory).toHaveBeenCalledWith('sampling')
  })

  describe('rootLabel wrapping', () => {
    it('should wrap multiple top-level categories under rootLabel key', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'N1', category: 'sampling' }),
        createMockNodeDef({ name: 'N2', category: 'loaders' })
      ])

      const { user, onUpdateSelectedCategory } = createRender({
        rootLabel: 'Extensions',
        rootKey: 'custom'
      })

      expect(screen.getByText('Extensions')).toBeInTheDocument()

      // Expand the wrapper root
      const customBtn = screen.getByTestId('category-custom')
      expect(customBtn).toBeInTheDocument()
      await user.click(customBtn)
      await waitFor(() => {
        expect(screen.getByText('sampling')).toBeInTheDocument()
        expect(screen.getByText('loaders')).toBeInTheDocument()
      })

      // Subcategories should be prefixed with the root key
      expect(screen.getByTestId('category-custom/sampling')).toBeInTheDocument()

      await user.click(screen.getByTestId('category-custom/sampling'))
      const calls = onUpdateSelectedCategory.mock.calls
      expect(calls[calls.length - 1]).toEqual(['custom/sampling'])
    })

    it('should derive root key from rootLabel when rootKey is not provided', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'N1', category: 'sampling' }),
        createMockNodeDef({ name: 'N2', category: 'loaders' })
      ])

      const { user, onUpdateSelectedCategory } = createRender({
        rootLabel: 'Custom'
      })

      await user.click(screen.getByTestId('category-custom'))
      await user.click(await screen.findByTestId('category-custom/sampling'))

      const calls = onUpdateSelectedCategory.mock.calls
      expect(calls[calls.length - 1]).toEqual(['custom/sampling'])
    })
  })

  describe('external selectedCategory updates', () => {
    it('should update expanded state when selectedCategory changes externally', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])

      const { rerender } = createRender({
        selectedCategory: 'most-relevant'
      })

      expect(screen.queryByText('advanced')).not.toBeInTheDocument()

      await rerender({ selectedCategory: 'sampling' })

      await screen.findByText('advanced')
    })
  })

  it('should emit autoExpand when there is a single root category', () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({ name: 'Node1', category: 'api' }),
      createMockNodeDef({ name: 'Node2', category: 'api/image' })
    ])

    const onAutoExpand = vi.fn()
    render(NodeSearchCategorySidebar, {
      props: {
        selectedCategory: 'most-relevant',
        onAutoExpand: onAutoExpand
      },
      global: { plugins: [testI18n] }
    })

    expect(onAutoExpand).toHaveBeenCalledWith('api')
  })

  it('should support deeply nested categories', async () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({ name: 'Node1', category: 'api' }),
      createMockNodeDef({ name: 'Node2', category: 'api/image' }),
      createMockNodeDef({ name: 'Node3', category: 'api/image/BFL' })
    ])

    const { user, onUpdateSelectedCategory } = createRender()

    // Only top-level visible initially
    expect(screen.getByText('api')).toBeInTheDocument()
    expect(screen.queryByText('image')).not.toBeInTheDocument()
    expect(screen.queryByText('BFL')).not.toBeInTheDocument()

    // Expand api
    await clickCategory(user, 'api', true)
    await screen.findByText('image')
    expect(screen.queryByText('BFL')).not.toBeInTheDocument()

    // Expand image
    await clickCategory(user, 'image', true)
    await screen.findByText('BFL')

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

      const { user, onUpdateSelectedCategory } = createRender()

      expect(screen.queryByText('advanced')).not.toBeInTheDocument()

      const samplingBtn = screen.getByTestId('category-sampling')
      samplingBtn.focus()
      await user.keyboard('{ArrowRight}')

      // Should have emitted select for sampling, expanding it
      expect(onUpdateSelectedCategory).toHaveBeenCalledWith('sampling')
    })

    it('should collapse an expanded tree node on ArrowLeft', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])

      const { user } = createRender()

      // First expand sampling by clicking
      await clickCategory(user, 'sampling', true)
      await screen.findByText('advanced')

      const samplingBtn = screen.getByTestId('category-sampling')
      samplingBtn.focus()
      await user.keyboard('{ArrowLeft}')

      // Collapse toggles internal state; children should be hidden
      await waitFor(() => {
        expect(screen.queryByText('advanced')).not.toBeInTheDocument()
      })
    })

    it('should focus first child on ArrowRight when already expanded', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])

      const { user } = createRender()
      await clickCategory(user, 'sampling', true)
      await screen.findByText('advanced')

      const samplingBtn = screen.getByTestId('category-sampling')
      samplingBtn.focus()
      await user.keyboard('{ArrowRight}')

      await waitFor(() => {
        expect(screen.getByTestId('category-sampling/advanced')).toHaveFocus()
      })
    })

    it('should focus parent on ArrowLeft from a leaf or collapsed node', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])

      const { user } = createRender()
      await clickCategory(user, 'sampling', true)
      await screen.findByText('advanced')

      screen.getByTestId('category-sampling/advanced').focus()
      await user.keyboard('{ArrowLeft}')

      await waitFor(() => {
        expect(screen.getByTestId('category-sampling')).toHaveFocus()
      })
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

      const { user } = createRender()

      // Step 1: Expand sampling
      await clickCategory(user, 'sampling', true)
      await screen.findByText('custom_sampling')

      // Step 2: Expand custom_sampling
      await clickCategory(user, 'custom_sampling', true)
      await screen.findByText('child')

      // Step 3: Navigate back to sampling (keyboard focus only)
      const samplingBtn = screen.getByTestId('category-sampling')
      samplingBtn.focus()

      // Step 4: Press left on sampling
      await user.keyboard('{ArrowLeft}')

      // Sampling should collapse entirely — custom_sampling should not be visible
      await waitFor(() => {
        expect(screen.queryByText('custom_sampling')).not.toBeInTheDocument()
      })
    })

    it('should collapse 4-deep tree to parent of level 2 on ArrowLeft', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'N1', category: 'a' }),
        createMockNodeDef({ name: 'N2', category: 'a/b' }),
        createMockNodeDef({ name: 'N3', category: 'a/b/c' }),
        createMockNodeDef({ name: 'N4', category: 'a/b/c/d' }),
        createMockNodeDef({ name: 'N5', category: 'other' })
      ])

      const { user } = createRender()

      // Expand a → a/b → a/b/c
      await clickCategory(user, 'a', true)
      await screen.findByText('b')

      await clickCategory(user, 'b', true)
      await screen.findByText('c')

      await clickCategory(user, 'c', true)
      await screen.findByText('d')

      // Focus level 2 (a/b) and press ArrowLeft
      const bBtn = screen.getByTestId('category-a/b')
      bBtn.focus()

      await user.keyboard('{ArrowLeft}')

      // Level 2 and below should collapse, but level 1 (a) stays expanded
      // so 'b' is still visible but 'c' and 'd' are not
      await waitFor(() => {
        expect(screen.queryByText('c')).not.toBeInTheDocument()
      })
      expect(screen.getByText('b')).toBeInTheDocument()
      expect(screen.queryByText('d')).not.toBeInTheDocument()
    })

    it('should set aria-expanded on tree nodes with children', () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])

      createRender()

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
