import { createTestingPinia } from '@pinia/testing'
import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'

import NodeSearchBox from './NodeSearchBox.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        addNodeFilterCondition: 'Add node filter condition',
        close: 'Close',
        nodes: 'Nodes',
        searchPlaceholder: 'Search nodes'
      }
    }
  }
})

let openModal: HTMLElement | undefined

afterEach(() => {
  if (openModal) {
    ZIndex.clear(openModal)
    openModal = undefined
  }
})

describe('NodeSearchBox dialog stacking', () => {
  it('opens its filter dialog above search opened over a lifted modal', async () => {
    openModal = document.createElement('div')
    ZIndex.set('modal', openModal, 3702)
    const managerZIndex = Number(openModal.style.zIndex)
    const Harness = defineComponent({
      components: { NodeSearchBox },
      directives: { rekaZIndex: vRekaZIndex },
      template: `
        <div v-reka-z-index data-testid="search-content">
          <NodeSearchBox :filters="[]" />
        </div>
      `
    })
    render(Harness, {
      global: {
        plugins: [createTestingPinia(), i18n],
        stubs: {
          NodePreview: true,
          NodeSearchFilter: true,
          NodeSearchItem: true,
          SearchAutocomplete: {
            template: '<input />',
            methods: { focus: vi.fn(), open: vi.fn() }
          }
        }
      }
    })
    const searchContent = screen.getByTestId('search-content')

    expect(Number(searchContent.style.zIndex)).toBeGreaterThan(managerZIndex)

    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: 'Add node filter condition' })
    )
    const filterContent = await screen.findByRole('dialog')

    expect(Number(filterContent.style.zIndex)).toBeGreaterThan(
      Number(searchContent.style.zIndex)
    )
  })
})
