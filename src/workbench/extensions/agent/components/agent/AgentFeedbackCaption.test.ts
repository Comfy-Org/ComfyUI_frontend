import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import { openFeedbackDialog } from '../../feedback'
import AgentFeedbackCaption from './AgentFeedbackCaption.vue'

vi.mock(import('../../feedback'), () => ({
  openFeedbackDialog: vi.fn()
}))

describe('AgentFeedbackCaption', () => {
  it('opens the agent feedback dialog when clicked', async () => {
    const user = userEvent.setup()
    render(AgentFeedbackCaption, { global: { plugins: [i18n] } })

    await user.click(screen.getByRole('button', { name: 'Share feedback' }))

    expect(openFeedbackDialog).toHaveBeenCalledWith('agent-panel')
  })
})
