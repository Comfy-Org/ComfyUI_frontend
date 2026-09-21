import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import type { AskUserPart } from '../../../services/agent/agentMessageParts'

import AskUserCard from './AskUserCard.vue'

const options: AskUserPart['options'] = [
  { id: 'sdxl', label: 'SDXL', description: 'Fast, 1024px, broad style range' },
  { id: 'flux', label: 'Flux Dev', description: 'Best prompt adherence' },
  { id: 'sd15', label: 'SD 1.5' }
]

function renderCard(ask: Partial<AskUserPart> = {}, answering = false) {
  const user = userEvent.setup()
  const result = render(AskUserCard, {
    props: {
      part: {
        type: 'askUser',
        askId: 'ask-1',
        prompt: 'Which model should I use?',
        options,
        minSelections: 1,
        maxSelections: 1,
        allowOther: false,
        ...ask
      },
      answering
    },
    global: { plugins: [i18n] }
  })
  const submit = () => screen.getByRole('button', { name: 'Submit' })
  return { user, submit, ...result }
}

describe('AskUserCard', () => {
  it('shows the prompt and every option with its description', () => {
    renderCard()

    expect(screen.getByText('Which model should I use?')).toBeInTheDocument()
    for (const { label, description } of options) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
      if (description)
        expect(
          screen.getByRole('radio', { name: label })
        ).toHaveAccessibleDescription(description)
    }
    expect(screen.getByRole('radiogroup')).toHaveAccessibleName(
      'Which model should I use?'
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Choose/)).not.toBeInTheDocument()
  })

  it('submits the one chosen option in single-choice mode', async () => {
    const { user, submit, emitted } = renderCard()
    expect(submit()).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'SDXL' }))
    await user.click(screen.getByText('Flux Dev'))
    expect(screen.getByRole('radio', { name: 'Flux Dev' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'SDXL' })).not.toBeChecked()

    await user.click(submit())
    expect(emitted().answer).toEqual([['ask-1', { selected: ['flux'] }]])
  })

  it('caps multi-choice at max and sends ids in option order', async () => {
    const { user, submit, emitted } = renderCard({ maxSelections: 2 })

    expect(screen.getByText('Choose up to 2')).toBeInTheDocument()
    expect(screen.getByRole('group')).toHaveAccessibleDescription(
      'Choose up to 2'
    )
    await user.click(screen.getByRole('checkbox', { name: 'SD 1.5' }))
    await user.click(screen.getByRole('checkbox', { name: 'SDXL' }))

    expect(screen.getByRole('checkbox', { name: 'Flux Dev' })).toBeDisabled()
    await user.click(submit())
    expect(emitted().answer).toEqual([
      ['ask-1', { selected: ['sdxl', 'sd15'] }]
    ])

    await user.click(screen.getByRole('checkbox', { name: 'SDXL' }))
    expect(screen.getByRole('checkbox', { name: 'Flux Dev' })).toBeEnabled()
  })

  it('keeps Submit disabled until the minimum is reached', async () => {
    const { user, submit } = renderCard({ minSelections: 2, maxSelections: 3 })

    expect(screen.getByText('Choose at least 2')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'SDXL' }))
    expect(submit()).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Flux Dev' }))
    expect(submit()).toBeEnabled()
  })

  it.for([
    { min: 2, max: 2, hint: 'Choose 2' },
    { min: 2, max: 3, hint: 'Choose 2 to 3', allowOther: true },
    { min: 1, max: 3, hint: 'Choose all that apply' }
  ])(
    'hints "$hint" for min $min / max $max',
    ({ min, max, hint, allowOther }) => {
      renderCard({
        minSelections: min,
        maxSelections: max,
        allowOther: allowOther ?? false
      })
      expect(screen.getByText(hint)).toBeInTheDocument()
    }
  )

  it('counts Other text as a selection and sends it trimmed', async () => {
    const { user, submit, emitted } = renderCard({
      maxSelections: 2,
      allowOther: true
    })

    await user.click(screen.getByRole('checkbox', { name: 'SDXL' }))
    const other = screen.getByRole('textbox', { name: 'Other' })
    await user.type(other, '  a LoRA  ')

    expect(screen.getByRole('checkbox', { name: 'Flux Dev' })).toBeDisabled()
    await user.click(submit())
    expect(emitted().answer).toEqual([
      ['ask-1', { selected: ['sdxl'], otherText: 'a LoRA' }]
    ])
  })

  it('disables an empty Other box once the options fill the cap', async () => {
    const { user } = renderCard({ maxSelections: 2, allowOther: true })

    await user.click(screen.getByRole('checkbox', { name: 'SDXL' }))
    await user.click(screen.getByRole('checkbox', { name: 'SD 1.5' }))

    expect(screen.getByRole('textbox', { name: 'Other' })).toBeDisabled()
  })

  it('treats Other and the options as exclusive in single-choice mode', async () => {
    const { user, submit, emitted } = renderCard({ allowOther: true })
    const other = screen.getByRole('textbox', { name: 'Other' })

    await user.click(screen.getByRole('radio', { name: 'SDXL' }))
    await user.type(other, 'Pony')
    expect(screen.getByRole('radio', { name: 'SDXL' })).not.toBeChecked()

    await user.click(submit())
    await user.click(screen.getByRole('radio', { name: 'Flux Dev' }))
    expect(other).toHaveValue('')
    await user.click(submit())

    expect(emitted().answer).toEqual([
      ['ask-1', { selected: [], otherText: 'Pony' }],
      ['ask-1', { selected: ['flux'] }]
    ])
  })

  it('ignores whitespace-only Other text', async () => {
    const { user, submit } = renderCard({ allowOther: true })

    await user.type(screen.getByRole('textbox', { name: 'Other' }), '   ')
    expect(submit()).toBeDisabled()
  })

  it('submits from the Other box with Enter', async () => {
    const { user, emitted } = renderCard({ allowOther: true })

    await user.type(
      screen.getByRole('textbox', { name: 'Other' }),
      'Pony{Enter}'
    )
    expect(emitted().answer).toEqual([
      ['ask-1', { selected: [], otherText: 'Pony' }]
    ])
  })

  it('does not submit on the Enter that commits an IME candidate', async () => {
    const { user, emitted } = renderCard({ allowOther: true })
    const other = screen.getByRole('textbox', { name: 'Other' })
    await user.type(other, '日本')

    // user-event cannot drive an IME, so raise the composing keydown directly.
    other.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true
      })
    )
    expect(emitted().answer).toBeUndefined()

    await user.keyboard('{Enter}')
    expect(emitted().answer).toEqual([
      ['ask-1', { selected: [], otherText: '日本' }]
    ])
  })

  it('lets an optional single choice be cleared again', async () => {
    const { user, submit, emitted } = renderCard({
      minSelections: 0,
      maxSelections: 1
    })

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'SDXL' }))
    await user.click(screen.getByRole('checkbox', { name: 'Flux Dev' }))
    expect(screen.getByRole('checkbox', { name: 'SDXL' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Flux Dev' })).toBeChecked()

    await user.click(screen.getByRole('checkbox', { name: 'Flux Dev' }))
    expect(screen.getByRole('checkbox', { name: 'Flux Dev' })).not.toBeChecked()
    await user.click(submit())
    expect(emitted().answer).toEqual([['ask-1', { selected: [] }]])
  })

  it('disables every control while the answer is in flight', () => {
    const { submit } = renderCard({ maxSelections: 2, allowOther: true }, true)

    for (const checkbox of screen.getAllByRole('checkbox'))
      expect(checkbox).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Other' })).toBeDisabled()
    expect(submit()).toBeDisabled()
    expect(submit()).toHaveAttribute('aria-busy', 'true')
  })

  it('disables the radios while the answer is in flight', () => {
    renderCard({}, true)

    for (const radio of screen.getAllByRole('radio'))
      expect(radio).toBeDisabled()
  })
})
