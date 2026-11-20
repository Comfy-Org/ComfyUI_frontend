import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { ActivityPart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

import ActivityTrace from './ActivityTrace.vue'

function renderTrace(parts: ActivityPart[]) {
  return render(ActivityTrace, {
    props: { parts },
    global: { plugins: [i18n] }
  })
}

describe('ActivityTrace', () => {
  it('BE-24672: says the reasoning was shortened where the stored thinking stops being whole', () => {
    renderTrace([
      { type: 'thinking', text: 'Round one.', state: 'done' },
      { type: 'thinking', text: 'Round two…', state: 'done', truncated: true }
    ])

    const notices = screen.getAllByTestId('agent-thinking-shortened')
    expect(notices).toHaveLength(1)
    expect(notices[0].textContent).toBe(
      'Reasoning shortened: the rest was too long to save.'
    )
  })

  it('shows no notice for a whole trace', () => {
    renderTrace([{ type: 'thinking', text: 'Round one.', state: 'done' }])

    expect(screen.queryByTestId('agent-thinking-shortened')).toBeNull()
  })
})
