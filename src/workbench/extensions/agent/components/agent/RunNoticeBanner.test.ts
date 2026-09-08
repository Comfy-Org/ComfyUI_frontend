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

  it('shows the edit-graph run notice on first launch', () => {
    mount()
    expect(screen.getByText(i18n.global.t('agent.runNotice'))).not.toBeNull()
  })

  it('shows the expanded run notice in the maximized panel', () => {
    mount(true)
    expect(
      screen.getByText(i18n.global.t('agent.runNoticeExpanded'))
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
