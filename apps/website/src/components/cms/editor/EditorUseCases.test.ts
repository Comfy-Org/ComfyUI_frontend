import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import EditorUseCases from './EditorUseCases.vue'

describe('editor editorial use-case picker', () => {
  it('searches and removes a selected phrase without splitting it or changing other strings', async () => {
    const user = userEvent.setup()
    const view = render(EditorUseCases, {
      props: {
        modelValue: ['Portraits, editorial', 'Animate characters']
      }
    })
    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    await user.type(screen.getByRole('searchbox'), 'portrait')
    expect(
      screen.queryByRole('button', {
        name: 'Remove use case Animate characters'
      })
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Remove use case Portraits, editorial'
      })
    )
    expect(view.emitted('update:modelValue')).toEqual([
      [['Animate characters']]
    ])
  })

  it('adds editorial text with Enter and clears the search buffer', async () => {
    const user = userEvent.setup()
    const view = render(EditorUseCases, {
      props: { modelValue: ['Existing'] }
    })
    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    await user.type(screen.getByRole('searchbox'), 'Product photography{Enter}')
    expect(view.emitted('update:modelValue')).toEqual([
      [['Existing', 'Product photography']]
    ])
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('does not manufacture a duplicate with different case or whitespace', async () => {
    const user = userEvent.setup()
    const view = render(EditorUseCases, {
      props: { modelValue: ['Portraits'] }
    })
    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    await user.type(screen.getByRole('searchbox'), ' portraits {Enter}')
    expect(
      screen.queryByRole('button', { name: /Add “/ })
    ).not.toBeInTheDocument()
    expect(view.emitted('update:modelValue')).toBeUndefined()
  })

  it('refuses changes after the picker is locked, even if already open', async () => {
    const user = userEvent.setup()
    const view = render(EditorUseCases, {
      props: { modelValue: ['Keep'] }
    })
    await user.click(screen.getByRole('button', { name: 'Use cases' }))
    await view.rerender({ disabled: true })
    await user.click(
      screen.getByRole('button', { name: 'Remove use case Keep' })
    )
    expect(view.emitted('update:modelValue')).toBeUndefined()
  })
})
