import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { ROUTER_MIGRATION_PROMPT } from '../../config/router-migration-prompt'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import RouterMigrationSection from './RouterMigrationSection.vue'

describe('RouterMigrationSection', () => {
  it.for<Locale>(['en', 'zh-CN'])(
    'renders the heading, a hidden prompt preview and the CTA in %s',
    (locale) => {
      render(RouterMigrationSection, { props: { locale } })

      expect(
        screen.getByRole('heading', {
          name: t('platform.routerMigration.heading', locale)
        })
      ).toBeVisible()
      expect(
        screen.getByText(ROUTER_MIGRATION_PROMPT.split('\n')[0], {
          selector: '[aria-hidden="true"] > span'
        })
      ).toBeVisible()
      expect(
        screen.getByRole('button', {
          name: t('platform.routerMigration.copy', locale)
        })
      ).toBeVisible()
      expect(screen.queryByRole('textbox')).toBeNull()
    }
  )

  it('copies the complete prompt on one click and confirms on the button', async () => {
    const user = userEvent.setup()
    render(RouterMigrationSection, { props: { locale: 'en' } })

    const cta = screen.getByRole('button', { name: 'Copy migration prompt' })
    await user.click(cta)

    expect(await navigator.clipboard.readText()).toBe(ROUTER_MIGRATION_PROMPT)
    expect(screen.getByRole('button', { name: 'Prompt copied' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Prompt copied')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('falls back to a selectable prompt when the clipboard is unavailable, and retries', async () => {
    const user = userEvent.setup()
    const write = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    render(RouterMigrationSection, { props: { locale: 'en' } })

    await user.click(
      screen.getByRole('button', { name: 'Copy migration prompt' })
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      t('platform.routerMigration.failed', 'en')
    )
    const fallback = screen.getByRole('textbox', { name: 'Migration prompt' })
    expect(fallback).toHaveValue(ROUTER_MIGRATION_PROMPT)
    expect(fallback).toHaveAttribute('readonly')
    expect(fallback).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(fallback).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(write).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Prompt copied' })).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
