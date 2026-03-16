import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeSearchCategorySidebar, {
  DEFAULT_CATEGORY
} from '@/components/searchbox/v2/NodeSearchCategorySidebar.vue'
import {
  createMockNodeDef,
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
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
  let wrapper: VueWrapper

  beforeEach(() => {
    vi.restoreAllMocks()
    setupTestPinia()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  async function createWrapper(props = {}) {
    wrapper = mount(NodeSearchCategorySidebar, {
      props: { selectedCategory: DEFAULT_CATEGORY, ...props },
      global: { plugins: [testI18n] },
      attachTo: document.body
    })
    await nextTick()
    return wrapper
  }

  async function clickCategory(
    wrapper: ReturnType<typeof mount>,
    text: string,
    exact = false
  ) {
    const btn = wrapper
      .findAll('button')
      .find((b) => (exact ? b.text().trim() === text : b.text().includes(text)))
    expect(btn, `Expected to find a button with text "${text}"`).toBeDefined()
    await btn!.trigger('click')
    await nextTick()
  }

  describe('preset categories', () => {
    it('should always show Most relevant', async () => {
      const wrapper = await createWrapper()
      expect(wrapper.text()).toContain('Most relevant')
    })

    it('should show Favorites only when bookmarks exist', async () => {
      const wrapper = await createWrapper()
      expect(wrapper.text()).not.toContain('Favorites')
    })

    it('should show Favorites when bookmarks are present', async () => {
      vi.spyOn(useNodeBookmarkStore(), 'bookmarks', 'get').mockReturnValue([
        'some-bookmark'
      ])
      const wrapper = await createWrapper()
      expect(wrapper.text()).toContain('Favorites')
    })

    it('should show Extensions source category when custom nodes exist', async () => {
      const wrapper = await createWrapper({ hasCustomNodes: true })
      expect(wrapper.text()).toContain('Extensions')
    })

    it('should not show Custom source category when no custom nodes exist', async () => {
      const wrapper = await createWrapper()
      expect(wrapper.text()).not.toContain('Custom')
    })

    it('should mark the selected preset category as selected', async () => {
      const wrapper = await createWrapper({
        selectedCategory: DEFAULT_CATEGORY
      })

      const mostRelevantBtn = wrapper.find(
        '[data-testid="category-most-relevant"]'
      )

      expect(mostRelevantBtn.attributes('aria-current')).toBe('true')
    })

    it('should emit update:selectedCategory when preset is clicked', async () => {
      vi.spyOn(useNodeBookmarkStore(), 'bookmarks', 'get').mockReturnValue([
        'some-bookmark'
      ])
      const wrapper = await createWrapper({
        selectedCategory: DEFAULT_CATEGORY
      })

      await clickCategory(wrapper, 'Favorites')

      expect(wrapper.emitted('update:selectedCategory')).toBeTruthy()
      expect(wrapper.emitted('update:selectedCategory')![0]).toEqual([
        'favorites'
      ])
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

      const wrapper = await createWrapper()

      expect(wrapper.text()).toContain('sampling')
      expect(wrapper.text()).toContain('loaders')
      expect(wrapper.text()).toContain('conditioning')
    })

    it('should emit update:selectedCategory when category is clicked', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' })
      ])
      await nextTick()

      const wrapper = await createWrapper()

      await clickCategory(wrapper, 'sampling')

      expect(wrapper.emitted('update:selectedCategory')![0]).toEqual([
        'sampling'
      ])
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

      const wrapper = await createWrapper()

      expect(wrapper.text()).not.toContain('advanced')

      await clickCategory(wrapper, 'sampling')

      expect(wrapper.text()).toContain('advanced')
      expect(wrapper.text()).toContain('basic')
    })

    it('should collapse sibling category when another is expanded', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'image' }),
        createMockNodeDef({ name: 'Node4', category: 'image/upscale' })
      ])
      await nextTick()

      const wrapper = await createWrapper()

      // Expand sampling
      await clickCategory(wrapper, 'sampling', true)
      expect(wrapper.text()).toContain('advanced')

      // Expand image — sampling should collapse
      await clickCategory(wrapper, 'image', true)

      expect(wrapper.text()).toContain('upscale')
      expect(wrapper.text()).not.toContain('advanced')
    })

    it('should emit update:selectedCategory when subcategory is clicked', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const wrapper = await createWrapper()

      // Expand sampling category
      await clickCategory(wrapper, 'sampling', true)

      // Click on advanced subcategory
      await clickCategory(wrapper, 'advanced')

      const emitted = wrapper.emitted('update:selectedCategory')!
      expect(emitted[emitted.length - 1]).toEqual(['sampling/advanced'])
    })
  })

  describe('category selection highlighting', () => {
    it('should mark selected top-level category as selected', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' })
      ])
      await nextTick()

      const wrapper = await createWrapper({ selectedCategory: 'sampling' })

      expect(
        wrapper
          .find('[data-testid="category-sampling"]')
          .attributes('aria-current')
      ).toBe('true')
    })

    it('should emit selected subcategory when expanded', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const wrapper = await createWrapper({
        selectedCategory: DEFAULT_CATEGORY
      })

      // Expand and click subcategory
      await clickCategory(wrapper, 'sampling', true)
      await clickCategory(wrapper, 'advanced')

      const emitted = wrapper.emitted('update:selectedCategory')!
      expect(emitted[emitted.length - 1]).toEqual(['sampling/advanced'])
    })
  })

  describe('hidePresets prop', () => {
    it('should hide preset categories when hidePresets is true', async () => {
      const wrapper = await createWrapper({ hidePresets: true })

      expect(wrapper.text()).not.toContain('Most relevant')
      expect(wrapper.text()).not.toContain('Custom')
    })
  })

  it('should emit autoExpand for single root and support deeply nested categories', async () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({ name: 'Node1', category: 'api' }),
      createMockNodeDef({ name: 'Node2', category: 'api/image' }),
      createMockNodeDef({ name: 'Node3', category: 'api/image/BFL' })
    ])
    await nextTick()

    const wrapper = await createWrapper()

    // Single root emits autoExpand
    expect(wrapper.emitted('autoExpand')?.[0]).toEqual(['api'])

    // Simulate parent handling autoExpand
    await wrapper.setProps({ selectedCategory: 'api' })
    await nextTick()

    expect(wrapper.text()).toContain('api')
    expect(wrapper.text()).toContain('image')
    expect(wrapper.text()).not.toContain('BFL')

    // Expand image
    await clickCategory(wrapper, 'image', true)

    expect(wrapper.text()).toContain('BFL')

    // Click BFL and verify emission
    await clickCategory(wrapper, 'BFL', true)

    const emitted = wrapper.emitted('update:selectedCategory')!
    expect(emitted[emitted.length - 1]).toEqual(['api/image/BFL'])
  })

  it('should emit category without root/ prefix', async () => {
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({ name: 'Node1', category: 'sampling' })
    ])
    await nextTick()

    const wrapper = await createWrapper()

    await clickCategory(wrapper, 'sampling')

    expect(wrapper.emitted('update:selectedCategory')![0][0]).toBe('sampling')
  })

  describe('keyboard navigation', () => {
    it('should expand a collapsed tree node on ArrowRight', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const wrapper = await createWrapper()

      expect(wrapper.text()).not.toContain('advanced')

      const samplingBtn = wrapper.find('[data-testid="category-sampling"]')
      await samplingBtn.trigger('keydown', { key: 'ArrowRight' })
      await nextTick()

      // Should have emitted select for sampling, expanding it
      expect(wrapper.emitted('update:selectedCategory')).toBeTruthy()
      expect(wrapper.emitted('update:selectedCategory')![0]).toEqual([
        'sampling'
      ])
    })

    it('should collapse an expanded tree node on ArrowLeft', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      // First expand sampling by clicking
      const wrapper = await createWrapper()
      await clickCategory(wrapper, 'sampling', true)

      expect(wrapper.text()).toContain('advanced')

      const samplingBtn = wrapper.find('[data-testid="category-sampling"]')
      await samplingBtn.trigger('keydown', { key: 'ArrowLeft' })
      await nextTick()

      // Collapse toggles internal state; children should be hidden
      expect(wrapper.text()).not.toContain('advanced')
    })

    it('should focus first child on ArrowRight when already expanded', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const wrapper = await createWrapper()
      await clickCategory(wrapper, 'sampling', true)

      expect(wrapper.text()).toContain('advanced')

      const samplingBtn = wrapper.find('[data-testid="category-sampling"]')
      await samplingBtn.trigger('keydown', { key: 'ArrowRight' })
      await nextTick()

      const advancedBtn = wrapper.find(
        '[data-testid="category-sampling/advanced"]'
      )
      expect(advancedBtn.element).toBe(document.activeElement)
    })

    it('should focus parent on ArrowLeft from a leaf or collapsed node', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const wrapper = await createWrapper()
      await clickCategory(wrapper, 'sampling', true)

      const advancedBtn = wrapper.find(
        '[data-testid="category-sampling/advanced"]'
      )
      await advancedBtn.trigger('keydown', { key: 'ArrowLeft' })
      await nextTick()

      const samplingBtn = wrapper.find('[data-testid="category-sampling"]')
      expect(samplingBtn.element).toBe(document.activeElement)
    })

    it('should set aria-expanded on tree nodes with children', async () => {
      useNodeDefStore().updateNodeDefs([
        createMockNodeDef({ name: 'Node1', category: 'sampling' }),
        createMockNodeDef({ name: 'Node2', category: 'sampling/advanced' }),
        createMockNodeDef({ name: 'Node3', category: 'loaders' })
      ])
      await nextTick()

      const wrapper = await createWrapper()

      const samplingTreeItem = wrapper
        .find('[data-testid="category-sampling"]')
        .element.closest('[role="treeitem"]')!
      expect(samplingTreeItem.getAttribute('aria-expanded')).toBe('false')

      // Leaf node should not have aria-expanded
      const loadersTreeItem = wrapper
        .find('[data-testid="category-loaders"]')
        .element.closest('[role="treeitem"]')!
      expect(loadersTreeItem.getAttribute('aria-expanded')).toBeNull()
    })
  })
})
