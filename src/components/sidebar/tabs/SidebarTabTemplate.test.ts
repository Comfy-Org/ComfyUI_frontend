import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import SidebarTabTemplate from './SidebarTabTemplate.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { close: 'Close' } } }
})

function renderTemplate(closable?: boolean) {
  return render(SidebarTabTemplate, {
    props: { title: 'Media Assets', closable },
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

describe('SidebarTabTemplate', () => {
  it('closes the sidebar panel from the close button', async () => {
    useSidebarTabStore().activeSidebarTabId = 'model-library'
    renderTemplate(true)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(useSidebarTabStore().activeSidebarTabId).toBeNull()
  })

  it('has no close button unless closable', () => {
    renderTemplate()

    expect(
      screen.queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument()
  })
})
