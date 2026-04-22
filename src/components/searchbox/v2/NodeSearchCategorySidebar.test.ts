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
    get: vi.fn(() => undefined),
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
    const buttons = screen.getAllByRole('button')
    const btn = buttons.find((b) =>
      exact ? b.textContent?.trim() === text : b.textContent?.includes(text)
    )
    expect(btn, `Expected to find a button with text "${text}"`).toBeDefined()
    await user.click(btn!)
    await nextTick()
  }

  describe('preset categories', () => {
    it('should render all preset categories', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({
          name: 'EssentialNode',
          essentials_category: 'basic',
          python_module: 'comfy_essentials'
        })
      ])
      await nextTick()

      await createRender()

      expect(screen.getByText('Most relevant')).toBeInTheDocument()
      expect(screen.getByText('Recents')).toBeInTheDocument()
      expect(screen.getByText('Favorites')).toBeInTheDocument()
      expect(screen.getByText('Essentials')).toBeInTheDocument()
      expect(screen.getByText('Blueprints')).toBeInTheDocument()
      expect(screen.getByText('Partner')).toBeInTheDocument()
      expect(screen.getByText('Comfy')).toBeInTheDocument()
      expect(screen.getByText('Extensions')).toBeInTheDocument()
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

      await clickCategory(user, 'Favorites')

      expect(onUpdateSelectedCategory).toHaveBeenCalledWith('favorites')
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
        createMockNodeDef({ name: 'Node3', category: 'sampling/basic' })
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
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' })
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
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' })
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

  it('should support deeply nested categories (3+ levels)', async () => {
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

  it('should emit category without root/ prefix', async () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({ name: 'Node1', category: 'sampling' })
    ])
    await nextTick()

    const { user, onUpdateSelectedCategory } = await createRender()

    await clickCategory(user, 'sampling')

    expect(onUpdateSelectedCategory).toHaveBeenCalledWith('sampling')
  })
})
