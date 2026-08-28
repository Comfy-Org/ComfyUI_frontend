import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import RunNoticeBanner from './RunNoticeBanner.vue'

const STORAGE_KEY = 'Comfy.AgentPanel.runNoticeDismissed'

function mount(expanded = false) {
  return render(RunNoticeBanner, {
    props: { expanded },
    global: { plugins: [i18n] }
  })
}

describe('RunNoticeBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('T-02 / PM-651 / FE-1307 shows the edit-graph notice and AI disclaimer on first launch', () => {
    mount()
    expect(
      screen.getByText(
        "The agent can modify the graph. You'll need to click run to execute the workflow."
      )
    ).not.toBeNull()
  })

  it('shows the expanded run notice in the maximized panel', () => {
    mount(true)
    expect(
      screen.getByText(
        "The agent can modify your workflow. You'll need to click run to execute."
      )
    ).not.toBeNull()
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
