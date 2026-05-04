import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeSearchFilterBar from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import {
  createMockNodeDef,
  setupTestPinia,
  testI18n
} from '@/components/searchbox/v2/__test__/testUtils'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

describe(NodeSearchFilterBar, () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setupTestPinia()
    const settings = useSettingStore()
    settings.settingValues['Comfy.NodeLibrary.Bookmarks.V2'] = []
    settings.settingValues['Comfy.NodeLibrary.BookmarksCustomization'] = {}
    useNodeDefStore().updateNodeDefs([
      createMockNodeDef({
        name: 'ImageNode',
        input: { required: { image: ['IMAGE', {}] } },
        output: ['IMAGE']
      })
    ])
  })

  async function createRender(props = {}) {
    const user = userEvent.setup()
    const onSelectCategory = vi.fn()
    const onUpdateIsSidebarOpen = vi.fn()
    render(NodeSearchFilterBar, {
      props: {
        onSelectCategory,
        'onUpdate:isSidebarOpen': onUpdateIsSidebarOpen,
        ...props
      },
      global: {
        plugins: [testI18n],
        stubs: {
          NodeSearchTypeFilterPopover: {
            template: '<div data-testid="popover"><slot /></div>',
            props: ['chip', 'selectedValues']
          }
        }
      }
    })
    await nextTick()
    return { user, onSelectCategory, onUpdateIsSidebarOpen }
  }

  const buttonTexts = () =>
    screen.getAllByRole('button').map((b) => b.textContent?.trim())

  it.each([
    { prop: 'hasFavorites', label: 'Bookmarked' },
    { prop: 'hasBlueprintNodes', label: 'Blueprints' },
    { prop: 'hasEssentialNodes', label: 'Essentials' },
    { prop: 'hasPartnerNodes', label: 'Partner' },
    { prop: 'hasCustomNodes', label: 'Extensions' }
  ] as const)(
    'shows the $label button only when $prop is true',
    async ({ prop, label }) => {
      await createRender()
      expect(buttonTexts()).not.toContain(label)

      cleanup()
      await createRender({ [prop]: true })
      expect(buttonTexts()).toContain(label)
    }
  )

  it('always renders the Comfy button and Input/Output type filter triggers', async () => {
    await createRender()
    const texts = buttonTexts()
    expect(texts).toContain('Comfy')
    expect(texts).toContain('Input')
    expect(texts).toContain('Output')
  })

  it('should emit selectCategory when category button is clicked', async () => {
    const { user, onSelectCategory } = await createRender({
      hasCustomNodes: true
    })

    await user.click(screen.getByRole('button', { name: 'Extensions' }))

    expect(onSelectCategory).toHaveBeenCalledWith('custom')
  })

  it('should apply active styling when activeCategory matches', async () => {
    await createRender({ activeCategory: 'custom', hasCustomNodes: true })

    expect(screen.getByRole('button', { name: 'Extensions' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('should expose aria-expanded=false and emit update:isSidebarOpen=true when toggled from collapsed', async () => {
    const { user, onUpdateIsSidebarOpen } = await createRender({
      isSidebarOpen: false
    })
    const toggle = screen.getByTestId('toggle-category-sidebar')

    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)
    expect(onUpdateIsSidebarOpen).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('should expose aria-expanded=true when isSidebarOpen prop is true', async () => {
    await createRender({ isSidebarOpen: true })
    expect(screen.getByTestId('toggle-category-sidebar')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
