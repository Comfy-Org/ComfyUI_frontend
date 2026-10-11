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
import type {
  AgentFreeUseNoticeMetadata,
  AgentFreeUsePlacement
} from '@/platform/telemetry/types'

import AgentPanel from './AgentPanel.vue'
import type { FreeUseVariant } from '../../experiments/freeUsePlacement'
import { FREE_USE_PLACEMENTS } from '../../experiments/freeUsePlacement'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

vi.mock(import('@/composables/auth/useCurrentUser'))

const PLACEMENTS = FREE_USE_PLACEMENTS.filter(
  (variant) => variant !== 'control'
)

function mount(
  freeUsePlacement: FreeUseVariant,
  onFreeUseNotice?: (metadata: AgentFreeUseNoticeMetadata) => void,
  creditsExhausted = false
) {
  return render(AgentPanel, {
    props: {
      entries: [],
      historyGroups: { current: [], today: [], yesterday: [], earlier: [] },
      freeUsePlacement,
      creditsExhausted,
      suppressFreeUseNotice: creditsExhausted,
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

  // DES-1221's four cells are four nested regions, outermost first. Visual
  // ordering *within* a region is geometry, which a jsdom test cannot see, so
  // `agentFreeUsePlacement.spec.ts` asserts that in a real browser; what this
  // level establishes is which region each arm renders into.
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

  it.for(PLACEMENTS)(
    'says nothing about free turns at %s once credits are exhausted',
    (variant) => {
      const onFreeUseNotice = vi.fn()
      mount(variant, onFreeUseNotice, true)

      expect(
        screen.getByTestId('agent-credits-exhausted-paywall')
      ).toBeInTheDocument()
      expect(screen.queryByRole('note', { name: 'Free use notice' })).toBeNull()
      expect(onFreeUseNotice).not.toHaveBeenCalled()
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
    const onFreeUseNotice = vi.fn()
    mount('above-input', onFreeUseNotice)

    expect(onFreeUseNotice.mock.calls).toEqual([
      [{ action: 'shown', placement: 'above-input' }]
    ])

    await userEvent.click(
      within(notice()).getByRole('button', { name: 'Dismiss' })
    )

    expect(onFreeUseNotice.mock.calls).toEqual([
      [{ action: 'shown', placement: 'above-input' }],
      [{ action: 'dismissed', placement: 'above-input' }]
    ])
  })
})
