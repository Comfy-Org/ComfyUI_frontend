import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import PromptQueue from './PromptQueue.vue'

const waiting = {
  id: 'waiting',
  text: 'Prompt message number 2',
  status: 'waiting' as const
}

describe('PromptQueue', () => {
  it('renders queued messages in their own card', () => {
    render(PromptQueue, {
      props: { items: [waiting] },
      global: { plugins: [i18n] }
    })

    const queue = screen.getByTestId('agent-prompt-queue')
    expect(queue).toBeVisible()
    expect(queue).toHaveClass('rounded-lg', 'border', 'bg-background')
  })

  it('hides when there are no queued messages', () => {
    render(PromptQueue, {
      props: { items: [] },
      global: { plugins: [i18n] }
    })

    expect(screen.queryByTestId('agent-prompt-queue')).toBeNull()
  })
})
