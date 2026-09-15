import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import EmptyState from './EmptyState.vue'

describe('EmptyState', () => {
  it('T-22 / PM-649 / FE-1288 renders every suggestion without truncating the inserted prompt', async () => {
    const user = userEvent.setup()
    const { emitted } = render(EmptyState, {
      global: { plugins: [i18n] }
    })
    const prompt = 'Build a workflow for image to video with 3 models'
    const suggestion = screen.getByRole('button', { name: prompt })

    expect(screen.getAllByRole('button')).toHaveLength(5)

    await user.click(suggestion)

    expect(emitted().insert).toEqual([[prompt]])
  })
})
