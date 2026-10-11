import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type {
  AgentFreeUseNoticeMetadata,
  AgentFreeUsePlacement
} from '@/platform/telemetry/types'

import { AGENT_FREE_USE_PLACEMENTS } from '@/platform/telemetry/types'

import AgentPanel from './AgentPanel.vue'
import type { FreeUseVariant } from '../../experiments/freeUsePlacement'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

vi.mock(import('@/composables/auth/useCurrentUser'))

const PLACEMENTS = AGENT_FREE_USE_PLACEMENTS

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
      plugins: [i18n],
      directives: { tooltip: {} },
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
  // `control` is also how AgentPanelRoot expresses every suppression — an
  // ineligible viewer, or an inline paywall on screen — so this one case
  // covers the panel's whole side of that contract.
  it('shows no notice in the control arm', () => {
    mount('control')

    expect(
      screen.queryByRole('note', {
        name: 'Free use notice'
      })
    ).toBeNull()
  })

  // Each of the four slots re-emits `@notice` separately, so a slot that lost
  // its re-emit, or carries the wrong `placement` literal, would send no
  // interactions while its exposure still counted.
  it.for(PLACEMENTS)(
    'renders and reports exactly one notice at %s',
    (variant) => {
      const onFreeUseNotice = vi.fn()
      mount(variant, onFreeUseNotice)

      expect(notice()).toHaveAttribute('data-placement', variant)
      expect(onFreeUseNotice.mock.calls).toEqual([
        [{ action: 'shown', placement: variant }]
      ])
    }
  )

  const REGIONS = [
    'agent-panel-footer',
    'agent-composer',
    'composer-input-box'
  ] as const
  type Region = (typeof REGIONS)[number]

  function noticeIn(region: Region) {
    return within(screen.getByTestId(region)).queryByRole('note', {
      name: 'Free use notice'
    })
  }

  const CASES: readonly [AgentFreeUsePlacement, readonly Region[]][] = [
    ['top-banner', []],
    ['near-composer', ['agent-panel-footer']],
    ['above-input', ['agent-panel-footer', 'agent-composer']],
    [
      'inside-input',
      ['agent-panel-footer', 'agent-composer', 'composer-input-box']
    ]
  ]

  it.for(CASES)('renders %s in its region', ([variant, containing]) => {
    mount(variant)

    expect(notice()).toBeInTheDocument()
    expect(REGIONS.filter((region) => noticeIn(region))).toEqual(containing)
  })

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

  it('reports the dismissal of the notice', async () => {
    const onFreeUseNotice = vi.fn()
    mount('above-input', onFreeUseNotice)

    await userEvent.click(
      within(notice()).getByRole('button', { name: 'Dismiss' })
    )

    expect(onFreeUseNotice.mock.calls).toEqual([
      [{ action: 'shown', placement: 'above-input' }],
      [{ action: 'dismissed', placement: 'above-input' }]
    ])
  })
})
