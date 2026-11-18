import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

import RunNoticeBanner from './RunNoticeBanner.vue'

const STORAGE_KEY = 'Comfy.AgentPanel.runNoticeDismissed'

function mount({
  workflowName = '3d_hunyuan-v2.1',
  expanded = false,
  hasWorkflowTarget = false,
  genericNoticeReady = false,
  hideIntro = false
}: {
  workflowName?: string
  expanded?: boolean
  hasWorkflowTarget?: boolean
  genericNoticeReady?: boolean
  hideIntro?: boolean
} = {}) {
  return render(RunNoticeBanner, {
    props: {
      expanded,
      workflowName,
      hasWorkflowTarget,
      genericNoticeReady,
      hideIntro
    },
    global: { plugins: [i18n] }
  })
}

describe('RunNoticeBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('P7-01: renders no bound-workflow edit card and never writes dismissal storage when a workflow is bound', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    const { rerender } = mount({ hasWorkflowTarget: true })

    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.queryByText(/The agent can now edit/i)).toBeNull()

    await rerender({
      workflowName: '3d_hunyuan-v2.1',
      hasWorkflowTarget: true,
      genericNoticeReady: true
    })

    expect(screen.queryByRole('note')).toBeNull()
    expect(setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything())
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it.for([false, true])(
    'shows the targetless notice only when ready for expanded=%s',
    async (expanded) => {
      const { rerender } = mount({ workflowName: '', expanded })
      expect(screen.queryByRole('note')).toBeNull()

      await rerender({
        expanded,
        workflowName: '',
        genericNoticeReady: true
      })
      expect(screen.getByRole('note')).toHaveTextContent(
        i18n.global.t(expanded ? 'agent.runNoticeExpanded' : 'agent.runNotice')
      )
    }
  )

  it('hides the notice and persists the dismissal when X is clicked', async () => {
    mount({ workflowName: '', genericNoticeReady: true })
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('note')).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('stays hidden on a fresh mount once dismissed', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    mount({ workflowName: '', genericNoticeReady: true })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('keeps a dismissed targetless notice hidden when ready', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    mount({ workflowName: '', genericNoticeReady: true })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('shows mismatch despite educational dismissal and preserves that dismissal when resolved', async () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    const { rerender, emitted } = render(RunNoticeBanner, {
      props: { workflowName: 'portrait', context: 'mismatch' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('note')).toHaveTextContent(
      i18n.global.t('agent.viewingDifferentWorkflow')
    )
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
    await userEvent.click(
      screen.getByRole('button', { name: 'Show target workflow: portrait' })
    )
    expect(emitted('showTarget')).toHaveLength(1)

    await rerender({ context: undefined })
    expect(screen.queryByRole('note')).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('says the target is unavailable despite educational dismissal and offers a New chat action', async () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    const { emitted } = render(RunNoticeBanner, {
      props: { context: 'unavailable' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('note')).toHaveTextContent(
      i18n.global.t('agent.targetWorkflowUnavailable')
    )
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
    await userEvent.click(
      screen.getByRole('button', {
        name: i18n.global.t('agent.startNewChat')
      })
    )
    expect(emitted('newChat')).toHaveLength(1)
  })

  it('still shows context notices when a workflow target is bound', () => {
    mount({ workflowName: 'portrait', hasWorkflowTarget: true })
    expect(screen.queryByRole('note')).toBeNull()

    render(RunNoticeBanner, {
      props: {
        workflowName: 'portrait',
        hasWorkflowTarget: true,
        context: 'mismatch'
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getByRole('note')).toHaveTextContent(
      i18n.global.t('agent.viewingDifferentWorkflow')
    )
  })

  it('hides only the introductory notice while greeting is visible', async () => {
    const view = render(RunNoticeBanner, {
      props: { genericNoticeReady: true, hideIntro: true },
      global: { plugins: [i18n] }
    })
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await view.rerender({
      workflowName: 'portrait',
      hideIntro: true,
      context: 'mismatch'
    })
    expect(screen.getByRole('note')).toHaveTextContent(
      i18n.global.t('agent.viewingDifferentWorkflow')
    )
    await view.rerender({
      workflowName: undefined,
      genericNoticeReady: true,
      hideIntro: false,
      context: undefined
    })
    expect(screen.getByRole('note')).toHaveTextContent(
      i18n.global.t('agent.runNotice')
    )
  })
})
