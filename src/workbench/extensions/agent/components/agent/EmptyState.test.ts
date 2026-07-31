import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import EmptyState from './EmptyState.vue'

describe('EmptyState', () => {
  it('bounds long suggestions without changing the inserted prompt', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, {
      global: { plugins: [i18n] }
    })
    const prompt = 'Build a workflow for image to video with 3 models'
    const suggestions = screen.getByTestId('suggested-prompts')
    const suggestion = screen.getByRole('button', { name: prompt })
    const label = screen.getByText(prompt)

    expect(suggestions).toHaveClass('w-full', 'max-w-[372px]', 'flex-wrap')
    expect(suggestion).toHaveClass('max-w-full', 'min-w-0')
    expect(label).toHaveClass('truncate')

    await user.click(suggestion)

    expect(emitted().insert).toEqual([[prompt]])
  })
})
