import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

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
  it('emits close when the close button is clicked', async () => {
    const { emitted } = renderTemplate(true)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(emitted('close')).toHaveLength(1)
  })

  it('has no close button unless closable', () => {
    renderTemplate()

    expect(
      screen.queryByRole('button', { name: 'Close' })
    ).not.toBeInTheDocument()
  })
})
