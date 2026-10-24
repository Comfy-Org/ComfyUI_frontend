import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type {
  AskUserPart,
  AskUserResolution
} from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import AskUserCard from './AskUserCard.vue'

const options: AskUserPart['options'] = [
  { id: 'sdxl', label: 'SDXL', description: 'Fast, 1024px, broad style range' },
  { id: 'flux', label: 'Flux Dev', description: 'Best prompt adherence' },
  { id: 'sd15', label: 'SD 1.5' }
]

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  escapeParameter: true,
  messages: { en: enMessages }
})

function renderCard(
  ask: Partial<AskUserPart> = {},
  { answering = false }: { answering?: boolean } = {}
) {
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
    expect(screen.getAllByRole('radio')).toEqual(
      options.map(({ label, description }) =>
        screen.getByRole('radio', {
          name: label,
          description: description ?? ''
        })
      )
    )
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

    expect(
      screen.getByRole('group', { name: 'Which model should I use?' })
    ).toHaveAccessibleDescription('Choose 1 to 2')
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
    { min: 2, max: 2, allowOther: false, hint: 'Choose 2' },
    { min: 2, max: 3, allowOther: true, hint: 'Choose 2 to 3' },
    { min: 1, max: 2, allowOther: false, hint: 'Choose 1 to 2' },
    { min: 1, max: 3, allowOther: false, hint: 'Choose at least 1' },
    { min: 0, max: 3, allowOther: false, hint: 'Choose all that apply' },
    { min: 0, max: 2, allowOther: false, hint: 'Choose up to 2' },
    { min: 0, max: 1, allowOther: false, hint: 'Choose one, or none' }
  ])(
    'hints "$hint" for min $min / max $max / Other $allowOther',
    ({ min, max, allowOther, hint }) => {
      renderCard({ minSelections: min, maxSelections: max, allowOther })
      expect(screen.getByText(hint)).toBeInTheDocument()
    }
  )

  it.for<{ name: string; ask: Partial<AskUserPart> }>([
    {
      name: 'one optional option',
      ask: { options: [options[0]], minSelections: 0, maxSelections: 1 }
    },
    {
      name: 'an optional Other box alone',
      ask: { options: [], allowOther: true, minSelections: 0, maxSelections: 1 }
    }
  ])('shows no hint for $name', ({ ask }) => {
    renderCard(ask)

    expect(screen.queryByText(/^Choose/)).not.toBeInTheDocument()
  })

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
      ['ask-1', { selected: ['sdxl'], other_text: 'a LoRA' }]
    ])
  })

  it('describes the Other box with the prompt and the selection hint', () => {
    renderCard({ maxSelections: 2, allowOther: true })

    expect(
      screen.getByRole('textbox', { name: 'Other' })
    ).toHaveAccessibleDescription('Which model should I use? Choose 1 to 2')
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
      ['ask-1', { selected: [], other_text: 'Pony' }],
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
      ['ask-1', { selected: [], other_text: 'Pony' }]
    ])
  })

  it('does not submit on the Enter that commits an IME candidate', async () => {
    const { user, emitted } = renderCard({ allowOther: true })
    const other = screen.getByRole('textbox', { name: 'Other' })
    await user.type(other, '日本')

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
      ['ask-1', { selected: [], other_text: '日本' }]
    ])
  })

  it('does not submit on an Enter that follows compositionend in the same turn', async () => {
    const { user, emitted } = renderCard({ allowOther: true })
    const other = screen.getByRole('textbox', { name: 'Other' })
    await user.type(other, '日本')

    other.dispatchEvent(new CompositionEvent('compositionstart'))
    other.dispatchEvent(new CompositionEvent('compositionend'))
    other.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    expect(emitted().answer).toBeUndefined()

    await vi.advanceTimersByTimeAsync(0)
    await user.keyboard('{Enter}')
    expect(emitted().answer).toEqual([
      ['ask-1', { selected: [], other_text: '日本' }]
    ])
  })

  it('does not submit on an Enter keydown with the IME key code', async () => {
    const { user, emitted } = renderCard({ allowOther: true })
    const other = screen.getByRole('textbox', { name: 'Other' })
    await user.type(other, '日本')

    other.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 229,
        bubbles: true
      })
    )

    expect(emitted().answer).toBeUndefined()
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
    const { submit } = renderCard(
      { maxSelections: 2, allowOther: true },
      { answering: true }
    )

    expect(screen.getByRole('checkbox', { name: 'SDXL' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Flux Dev' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'SD 1.5' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Other' })).toBeDisabled()
    expect(submit()).toBeDisabled()
    expect(submit()).toHaveAttribute('aria-busy', 'true')
  })

  it('disables the radios while the answer is in flight', () => {
    renderCard({}, { answering: true })

    expect(screen.getByRole('radio', { name: 'SDXL' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Flux Dev' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'SD 1.5' })).toBeDisabled()
  })

  describe('once resolved', () => {
    it('reads back the chosen options and free text instead of the form', () => {
      renderCard({
        maxSelections: 2,
        allowOther: true,
        resolution: {
          status: 'answered',
          selected: ['sd15', 'sdxl'],
          otherText: 'a LoRA'
        }
      })

      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Answered')
      expect(
        within(status)
          .getAllByRole('listitem')
          .map((item) => item.textContent.trim())
      ).toEqual(['SD 1.5', 'SDXL', 'Other: a LoRA'])
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Submit' })
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/^Choose/)).not.toBeInTheDocument()
    })

    it('reads back a URL in Other exactly as entered', () => {
      const url = 'https://huggingface.co/a/b?x=1&y=2'
      renderCard({
        allowOther: true,
        resolution: {
          status: 'answered',
          selected: [],
          otherText: url
        }
      })

      expect(screen.getByRole('listitem')).toHaveTextContent(`Other: ${url}`)
    })

    it.for<{ resolution: AskUserResolution; copy: string }>([
      {
        resolution: { status: 'closed' },
        copy: 'This question was closed without an answer.'
      },
      {
        resolution: { status: 'retired' },
        copy: 'This question is no longer open here.'
      },
      {
        resolution: { status: 'unconfirmed' },
        copy: "We couldn't confirm your answer reached the agent."
      }
    ])(
      'says "$copy" for a $resolution.status question',
      ({ resolution, copy }) => {
        renderCard({ resolution })

        expect(screen.getByRole('status')).toHaveTextContent(copy)
        expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      }
    )

    it('reads as answered, naming nothing, when the server named no answer', () => {
      renderCard({ resolution: { status: 'answered', selected: [] } })

      expect(screen.getByRole('status')).toHaveTextContent('Answered')
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    })

    it('turns read-only in place when the resolution arrives', async () => {
      const { user, rerender, emitted } = renderCard()
      await user.click(screen.getByRole('radio', { name: 'Flux Dev' }))

      await rerender({
        part: {
          type: 'askUser',
          askId: 'ask-1',
          prompt: 'Which model should I use?',
          options,
          minSelections: 1,
          maxSelections: 1,
          allowOther: false,
          resolution: { status: 'answered', selected: ['flux'] }
        }
      })

      expect(screen.getByRole('status')).toHaveTextContent('Flux Dev')
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      expect(emitted().answer).toBeUndefined()
    })
  })
})
