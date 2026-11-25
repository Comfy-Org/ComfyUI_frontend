import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { AgentFreeUseNoticeMetadata } from '@comfyorg/telemetry/types'

import type { FreeUseVariant } from '@/workbench/extensions/agent/experiments/freeUsePlacement'
import AgentPanel from './AgentPanel.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

vi.mock(import('@/composables/auth/useCurrentUser'))

function mount(
  freeUsePlacement: FreeUseVariant,
  onFreeUseNotice?: (metadata: AgentFreeUseNoticeMetadata) => void
) {
  return render(AgentPanel, {
    props: {
      entries: [],
      historyGroups: { current: [], today: [], yesterday: [], earlier: [] },
      freeUsePlacement,
      onFreeUseNotice
    },
    global: {
      plugins: [i18n]
    }
  })
}

function notice() {
  return screen.getByRole('note', { name: 'Free use notice' })
}

describe('AgentPanel free-use notice', () => {
  it('shows no notice for Cloud control', () => {
    mount('control')

    expect(screen.queryByRole('note', { name: 'Free use notice' })).toBeNull()
  })

  it('renders and reports the Local notice beside the composer', () => {
    const onFreeUseNotice = vi.fn()
    mount('near-composer', onFreeUseNotice)

    expect(notice()).toHaveAttribute('data-placement', 'near-composer')
    expect(
      within(screen.getByTestId('agent-panel-footer')).getByRole('note', {
        name: 'Free use notice'
      })
    ).toBeInTheDocument()
    expect(onFreeUseNotice.mock.calls).toEqual([
      [{ action: 'shown', placement: 'near-composer' }]
    ])
  })

  it('leaves the starter prompts and placeholder unchanged', () => {
    const control = mount('control')
    const controlPrompts = screen.getByTestId('suggested-prompts').textContent
    const controlPlaceholder = screen.getByRole('textbox').ariaLabel
    control.unmount()

    mount('near-composer')

    expect(screen.getByTestId('suggested-prompts').textContent).toBe(
      controlPrompts
    )
    expect(screen.getByRole('textbox').ariaLabel).toBe(controlPlaceholder)
  })

  it('reports dismissal of the Local notice', async () => {
    const onFreeUseNotice = vi.fn()
    mount('near-composer', onFreeUseNotice)

    await userEvent.click(
      within(notice()).getByRole('button', { name: 'Dismiss' })
    )

    expect(onFreeUseNotice.mock.calls).toEqual([
      [{ action: 'shown', placement: 'near-composer' }],
      [{ action: 'dismissed', placement: 'near-composer' }]
    ])
  })
})
