import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The inline prompt editor builds a ResizeObserver at import time; jsdom omits it.
vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

import { i18n } from '@/i18n'

import AgentPanel from './AgentPanel.vue'
import type { FreeUseVariant } from '../../experiments/freeUsePlacement'
import { FREE_USE_PLACEMENTS } from '../../experiments/freeUsePlacement'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

const PLACEMENTS = FREE_USE_PLACEMENTS.filter(
  (variant) => variant !== 'control'
)

function mount(freeUsePlacement: FreeUseVariant) {
  return render(AgentPanel, {
    props: {
      entries: [],
      historyGroups: { current: [], today: [], yesterday: [], earlier: [] },
      freeUsePlacement
    },
    global: {
      plugins: [i18n],
      stubs: { WorkflowSelectorChip: true }
    }
  })
}

function notice() {
  return screen.getByRole('note', {
    name: 'Free use notice'
  })
}

describe('AgentPanel free-use placement', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows no notice in the control arm', () => {
    mount('control')

    expect(
      screen.queryByRole('note', {
        name: 'Free use notice'
      })
    ).toBeNull()
  })

  it.for(PLACEMENTS)('shows exactly one notice for %s', (variant) => {
    mount(variant)

    const notices = screen.getAllByRole('note', {
      name: 'Free use notice'
    })
    expect(notices).toHaveLength(1)
    expect(notices[0]).toHaveAttribute('data-placement', variant)
  })

  it.for([
    ['top-banner', true, false, false],
    ['near-composer', false, false, false],
    ['above-input', false, true, false],
    ['inside-input', false, true, true]
  ] as const)(
    'renders %s in its region',
    ([variant, beforePrompts, inComposer, inInputBox]) => {
      mount(variant)

      const prompts = screen.getByTestId('suggested-prompts')
      expect(
        Boolean(
          notice().compareDocumentPosition(prompts) &
          Node.DOCUMENT_POSITION_FOLLOWING
        )
      ).toBe(beforePrompts)
      expect(screen.getByTestId('agent-composer').contains(notice())).toBe(
        inComposer
      )
      expect(screen.getByTestId('composer-input-box').contains(notice())).toBe(
        inInputBox
      )
    }
  )

  it('hides the top banner while chat history is open', async () => {
    mount('top-banner')

    await userEvent.click(
      screen.getByRole('button', { name: 'Show chat history' })
    )

    expect(
      screen.queryByRole('note', {
        name: 'Free use notice'
      })
    ).toBeNull()
  })

  it.for(PLACEMENTS)(
    'leaves the starter prompts and placeholder untouched at %s',
    (variant) => {
      const control = mount('control')
      const controlPrompts = screen.getByTestId('suggested-prompts').textContent
      const controlPlaceholder = screen.getByRole('textbox').ariaLabel
      control.unmount()

      mount(variant)

      expect(screen.getByTestId('suggested-prompts').textContent).toBe(
        controlPrompts
      )
      expect(screen.getByRole('textbox').ariaLabel).toBe(controlPlaceholder)
    }
  )

  it('reports the impression and the dismissal of the notice', async () => {
    const { emitted } = mount('above-input')

    expect(emitted('freeUseNotice')).toEqual([
      [{ action: 'shown', placement: 'above-input' }]
    ])

    await userEvent.click(
      within(notice()).getByRole('button', { name: 'Dismiss' })
    )

    expect(emitted('freeUseNotice')).toEqual([
      [{ action: 'shown', placement: 'above-input' }],
      [{ action: 'dismissed', placement: 'above-input' }]
    ])
  })
})
