import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import RunNoticeBanner from './RunNoticeBanner.vue'

const STORAGE_KEY = 'Comfy.AgentPanel.runNoticeDismissed'

function mount(workflowName = '3d_hunyuan-v2.1', expanded = false) {
  return render(RunNoticeBanner, {
    props: { expanded },
    attrs: { workflowName },
    global: { plugins: [i18n] }
  })
}

describe('RunNoticeBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('names the one workflow the agent can edit', () => {
    mount()
    expect(screen.getByRole('note')).toHaveTextContent(
      'The agent can now edit 3d_hunyuan-v2.1. It works on 1 workflow at a time, and you can switch workflows during chat.'
    )
    expect(screen.getByText('3d_hunyuan-v2.1')).toHaveClass(
      'underline',
      'decoration-solid'
    )
  })

  it('shows the expanded run notice in the maximized panel', () => {
    mount('3d_hunyuan-v2.1', true)
    expect(screen.getByRole('note')).toHaveTextContent(
      'The agent can now edit 3d_hunyuan-v2.1. It works on 1 workflow at a time, and you can switch workflows during chat.'
    )
  })

  it('hides the notice and persists the dismissal when X is clicked', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('note')).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('stays hidden on a fresh mount once dismissed', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    mount()
    expect(screen.queryByRole('note')).toBeNull()
  })
})
