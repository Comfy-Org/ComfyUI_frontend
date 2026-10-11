import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json' with { type: 'json' }

import SearchFilterChip from './SearchFilterChip.vue'

describe('SearchFilterChip', () => {
  it('identifies removal controls by filter type and value', async () => {
    const user = userEvent.setup()
    const removeInput = vi.fn()
    const removeOutput = vi.fn()
    render(
      {
        components: { SearchFilterChip },
        setup: () => ({ removeInput, removeOutput }),
        template: `
          <SearchFilterChip text="MODEL" badge="I" badge-class="i-badge" @remove="removeInput" />
          <SearchFilterChip text="MODEL" badge="O" badge-class="o-badge" @remove="removeOutput" />`
      },
      {
        global: {
          plugins: [
            createI18n({ legacy: false, locale: 'en', messages: { en } })
          ]
        }
      }
    )

    expect(
      screen.getByRole('button', { name: 'Remove O: MODEL filter' })
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Remove I: MODEL filter' })
    )

    expect(removeInput).toHaveBeenCalledOnce()
    expect(removeOutput).not.toHaveBeenCalled()
  })
})
