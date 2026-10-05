import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'

import { publishSkillPack } from '../api/skillsApi'
import type { SkillPack } from '../types'
import SkillPackFormDialog from './SkillPackFormDialog.vue'

vi.mock(import('../api/skillsApi'), { spy: true })

const pack: SkillPack = {
  id: 'pack-1',
  name: 'my-pack',
  description: 'load me',
  body: 'do it',
  body_hash: 'abc',
  created_at: '2026-08-22T00:00:00Z',
  updated_at: '2026-08-22T00:00:00Z'
}

function renderForm() {
  return render(SkillPackFormDialog, {
    props: { visible: true },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}

describe('SkillPackFormDialog', () => {
  it('preserves and publishes an astral trigger within the code-point limit', async () => {
    const user = userEvent.setup()
    const description = '😀'.repeat(700)
    vi.mocked(publishSkillPack).mockResolvedValue({ ...pack, description })
    renderForm()

    await user.type(
      await screen.findByRole('textbox', { name: 'Name' }),
      'my-pack'
    )
    await user.click(screen.getByRole('textbox', { name: 'Trigger line' }))
    await user.paste(description)
    expect(screen.getByRole('textbox', { name: 'Trigger line' })).toHaveValue(
      description
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Instructions' }),
      'do it'
    )
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    expect(publishSkillPack).toHaveBeenCalledWith({
      name: 'my-pack',
      description,
      body: 'do it'
    })
  })

  it.for([
    ['Name', '', 'load me', 'do it', 'Name is required'],
    ['Trigger line', 'my-pack', '', 'do it', 'Trigger line is required'],
    ['Instructions', 'my-pack', 'load me', '', 'Instructions are required'],
    [
      'Trigger line',
      'my-pack',
      '😀'.repeat(1025),
      'do it',
      'Trigger line must be 1024 characters or less'
    ]
  ])(
    'associates the %s validation error with its input',
    async ([label, name, description, body, message]) => {
      const user = userEvent.setup()
      renderForm()
      await user.click(await screen.findByRole('textbox', { name: 'Name' }))
      await user.paste(name)
      await user.click(screen.getByRole('textbox', { name: 'Trigger line' }))
      await user.paste(description)
      await user.click(screen.getByRole('textbox', { name: 'Instructions' }))
      await user.paste(body)
      await user.click(screen.getByRole('button', { name: 'Publish' }))

      const input = screen.getByRole('textbox', { name: label })
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAccessibleDescription(message)
      expect(screen.getByRole('alert')).toHaveTextContent(message)
      expect(publishSkillPack).not.toHaveBeenCalled()
    }
  )
})
