import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import NodeSearchFilterBar from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
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

describe(NodeSearchFilterBar, () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setupTestPinia()
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
    render(NodeSearchFilterBar, {
      props: { onSelectCategory, ...props },
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
    return { user, onSelectCategory }
  }

  it('should render Extensions button and Input/Output popover triggers', async () => {
    await createRender({ hasCustomNodes: true })

    const buttons = screen.getAllByRole('button')
    const texts = buttons.map((b) => b.textContent?.trim())
    expect(texts).toContain('Extensions')
    expect(texts).toContain('Input')
    expect(texts).toContain('Output')
  })

  it('should always render Comfy button', async () => {
    await createRender()
    const texts = screen.getAllByRole('button').map((b) => b.textContent?.trim())
    expect(texts).toContain('Comfy')
  })

  it('should render conditional category buttons when matching nodes exist', async () => {
    await createRender({
      hasFavorites: true,
      hasEssentialNodes: true,
      hasBlueprintNodes: true,
      hasPartnerNodes: true
    })
    const texts = screen.getAllByRole('button').map((b) => b.textContent?.trim())
    expect(texts).toContain('Bookmarked')
    expect(texts).toContain('Blueprints')
    expect(texts).toContain('Partner')
    expect(texts).toContain('Essentials')
  })

  it('should not render Extensions button when no custom nodes exist', async () => {
    await createRender()
    const texts = screen.getAllByRole('button').map((b) => b.textContent?.trim())
    expect(texts).not.toContain('Extensions')
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
})
