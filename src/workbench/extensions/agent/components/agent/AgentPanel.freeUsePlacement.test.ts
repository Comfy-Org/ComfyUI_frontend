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
import { FREE_USE_NOTICE_DISMISSED_KEY } from './freeUseNoticeDismissal'

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
      directives: { tooltip: {} },
      stubs: { WorkflowSelectorChip: true }
    }
  })
}

function notice() {
  return screen.getByTestId('agent-free-use-notice')
}

function isBefore(first: Element, second: Element): boolean {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  )
}

describe('AgentPanel free-use placement', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows no notice in the control arm', () => {
    mount('control')

    expect(screen.queryByTestId('agent-free-use-notice')).toBeNull()
  })

  it.for(PLACEMENTS)('shows exactly one notice for %s', (variant) => {
    mount(variant)

    const notices = screen.getAllByTestId('agent-free-use-notice')
    expect(notices).toHaveLength(1)
    expect(notices[0]).toHaveAttribute('data-placement', variant)
  })

  it('puts the top banner above the chat body, outside the composer', () => {
    mount('top-banner')

    expect(isBefore(notice(), screen.getByTestId('suggested-prompts'))).toBe(
      true
    )
    expect(screen.getByTestId('agent-composer').contains(notice())).toBe(false)
  })

  it('puts the near-composer notice between the chat body and the composer', () => {
    mount('near-composer')

    expect(isBefore(screen.getByTestId('suggested-prompts'), notice())).toBe(
      true
    )
    expect(isBefore(notice(), screen.getByTestId('agent-composer'))).toBe(true)
    expect(screen.getByTestId('agent-composer').contains(notice())).toBe(false)
  })

  it('puts the above-input notice inside the composer but outside the input', () => {
    mount('above-input')

    expect(screen.getByTestId('agent-composer').contains(notice())).toBe(true)
    expect(screen.getByTestId('composer-input-box').contains(notice())).toBe(
      false
    )
    expect(isBefore(notice(), screen.getByTestId('composer-input-box'))).toBe(
      true
    )
  })

  it('puts the inside-input notice inside the input, above the prompt field', () => {
    mount('inside-input')

    expect(screen.getByTestId('composer-input-box').contains(notice())).toBe(
      true
    )
    expect(isBefore(notice(), screen.getByRole('textbox'))).toBe(true)
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

    expect(emitted('freeUseNotice')).toEqual([['shown']])

    await userEvent.click(
      within(notice()).getByRole('button', { name: 'Dismiss' })
    )

    expect(emitted('freeUseNotice')).toEqual([['shown'], ['dismissed']])
    expect(localStorage.getItem(FREE_USE_NOTICE_DISMISSED_KEY)).toBe('true')
  })
})
