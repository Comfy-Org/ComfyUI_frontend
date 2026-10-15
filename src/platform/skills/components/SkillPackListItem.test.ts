import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'

import type { SkillPack } from '../types'
import SkillPackListItem from './SkillPackListItem.vue'

const pack: SkillPack = {
  id: 'pack-1',
  name: 'my-render-defaults',
  description: 'load me when upscaling',
  body: 'always upscale with 4x-UltraSharp',
  body_hash: 'abc',
  created_at: '2026-08-22T00:00:00Z',
  updated_at: '2026-08-22T00:00:00Z'
}

function renderItem(props: { disabled?: boolean; loading?: boolean } = {}) {
  return render(SkillPackListItem, {
    props: { pack, ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}

describe('SkillPackListItem', () => {
  it('opens the editor when the row is clicked', async () => {
    const user = userEvent.setup()
    const { emitted } = renderItem()

    await user.click(screen.getByRole('button', { name: pack.name }))

    expect(emitted('edit')).toHaveLength(1)
    expect(emitted('delete')).toBeUndefined()
  })

  it.for(['{Enter}', ' '])('opens the focused row with %s', async (key) => {
    const user = userEvent.setup()
    const { emitted } = renderItem()

    await user.tab()
    expect(screen.getByRole('button', { name: pack.name })).toHaveFocus()
    await user.keyboard(key)

    expect(emitted('edit')).toHaveLength(1)
  })

  it.for([
    ['Edit', 'edit', 'delete'],
    ['Delete', 'delete', 'edit']
  ])('invokes only the %s shortcut', async ([label, event, otherEvent]) => {
    const user = userEvent.setup()
    const { emitted } = renderItem()

    await user.click(screen.getByRole('button', { name: label }))

    expect(emitted(event)).toHaveLength(1)
    expect(emitted(otherEvent)).toBeUndefined()
  })

  it('allows keyboard navigation from the row to both actions', async () => {
    const user = userEvent.setup()
    renderItem()

    await user.tab()
    expect(screen.getByRole('button', { name: pack.name })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
  })

  it.for([{ disabled: true }, { loading: true }])(
    'does not open an unavailable row (%j)',
    async (props) => {
      const user = userEvent.setup()
      const { emitted } = renderItem(props)
      const row = screen.getByRole('button', { name: pack.name })

      expect(row).toBeDisabled()
      await user.click(row)

      expect(emitted('edit')).toBeUndefined()
    }
  )
})
