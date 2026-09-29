import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import NodeHelpPage from './NodeHelpPage.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { g: { back: 'Back' }, sideToolbar: { closeSidebar: 'Close sidebar' } }
  }
})

describe('NodeHelpPage', () => {
  it('closes the sidebar panel from the close button', async () => {
    useSidebarTabStore().activeSidebarTabId = 'node-library'
    render(NodeHelpPage, {
      props: {
        node: new ComfyNodeDefImpl({
          name: 'KSampler',
          display_name: 'KSampler',
          category: 'sampling',
          input: {},
          output: [],
          output_name: [],
          output_is_list: [],
          output_node: false,
          python_module: 'nodes',
          description: ''
        })
      },
      global: {
        plugins: [i18n],
        directives: { tooltip: {} },
        stubs: { NodeHelpContent: true }
      }
    })

    await userEvent.click(screen.getByRole('button', { name: 'Close sidebar' }))

    expect(useSidebarTabStore().activeSidebarTabId).toBeNull()
  })
})
