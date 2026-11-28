import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import AppDialogPanel from './AppDialogPanel.vue'

it('leaves closing to the caller and updates its accessible label with the locale', async () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { g: { close: 'Close' } }, fr: { g: { close: 'Fermer' } } }
  })
  const onClose = vi.fn()
  const { rerender } = render(AppDialogPanel, {
    slots: { title: 'Workspace', default: 'Settings', footer: 'Save' },
    global: { plugins: [i18n] }
  })

  expect(
    screen.queryByRole('button', { name: 'Close' })
  ).not.toBeInTheDocument()
  expect(screen.getByText('Workspace')).toBeVisible()
  expect(screen.getByText('Settings')).toBeVisible()
  expect(screen.getByText('Save')).toBeVisible()
  await rerender({ onClose })
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalledOnce()
  expect(screen.getByText('Settings')).toBeVisible()

  i18n.global.locale.value = 'fr'
  await nextTick()
  expect(screen.getByRole('button', { name: 'Fermer' })).toBeVisible()
})
