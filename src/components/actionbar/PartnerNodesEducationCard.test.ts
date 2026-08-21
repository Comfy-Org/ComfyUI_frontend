import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import * as runGateModule from '@/composables/billing/usePartnerNodesRunGate'
import * as partnerNodesInGraphModule from '@/composables/node/usePartnerNodesInGraph'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { usePartnerNodesEducationStore } from '@/platform/workflow/templates/stores/partnerNodesEducationStore'

import PartnerNodesEducationCard from './PartnerNodesEducationCard.vue'

vi.mock('@/composables/node/usePartnerNodesInGraph', async () => {
  const { computed, ref } = await import('vue')
  const hasNodes = ref(true)
  return {
    usePartnerNodesInGraph: () => ({
      hasPartnerNodes: computed(() => hasNodes.value)
    }),
    __setHasPartnerNodes: (value: boolean) => {
      hasNodes.value = value
    }
  }
})

vi.mock('@/composables/billing/usePartnerNodesRunGate', async () => {
  const { computed, ref } = await import('vue')
  const gate = ref<'sign-in' | 'none'>('none')
  return {
    usePartnerNodesRunGate: () => ({
      gate: computed(() => gate.value),
      partnerNodes: computed(() => [
        { nodeName: 'KlingNode', displayName: 'Kling' }
      ])
    }),
    __setGate: (value: 'sign-in' | 'none') => {
      gate.value = value
    }
  }
})

const showApiNodesSignInDialog = vi.fn()
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showApiNodesSignInDialog })
}))

const { __setHasPartnerNodes } =
  partnerNodesInGraphModule as typeof partnerNodesInGraphModule & {
    __setHasPartnerNodes: (value: boolean) => void
  }
const { __setGate } = runGateModule as typeof runGateModule & {
  __setGate: (value: 'sign-in' | 'none') => void
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const copy = enMessages.partnerNodesEducation

const CARD_TESTID = 'partner-nodes-education-card'

let pinia: ReturnType<typeof createTestingPinia>

function renderCard() {
  return render(PartnerNodesEducationCard, {
    global: { plugins: [pinia, i18n] }
  })
}

describe('PartnerNodesEducationCard', () => {
  beforeEach(() => {
    pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)
    __setHasPartnerNodes(true)
    __setGate('none')
    showApiNodesSignInDialog.mockClear()
  })

  it('stays hidden until a paid template load requests it', () => {
    renderCard()
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()
  })

  it('shows when a paid template load requests it', async () => {
    const store = usePartnerNodesEducationStore()
    renderCard()

    store.requestCard()
    await nextTick()
    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument()
    expect(screen.getByText(copy.pitch)).toBeInTheDocument()
  })

  it('dismisses via the close button', async () => {
    const store = usePartnerNodesEducationStore()
    renderCard()
    store.requestCard()
    await nextTick()

    await userEvent.click(screen.getByTestId('partner-nodes-education-dismiss'))
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()
  })

  it('survives partner nodes registering after the request (template load)', async () => {
    const store = usePartnerNodesEducationStore()
    __setHasPartnerNodes(false)
    renderCard()
    store.requestCard()
    await nextTick()

    __setHasPartnerNodes(true)
    await nextTick()
    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument()
    expect(store.isCardRequested).toBe(true)
  })

  it('hides when the graph no longer contains partner nodes', async () => {
    const store = usePartnerNodesEducationStore()
    renderCard()
    store.requestCard()
    await nextTick()
    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument()

    __setHasPartnerNodes(false)
    await nextTick()
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()
  })

  it('does not resurface on a later partner-node graph the template never described', async () => {
    const store = usePartnerNodesEducationStore()
    renderCard()
    store.requestCard()
    await nextTick()

    __setHasPartnerNodes(false)
    await nextTick()

    // Opening an unrelated workflow that happens to contain partner nodes must
    // not revive a card that claims a template introduced them.
    __setHasPartnerNodes(true)
    await nextTick()
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()
    expect(store.isCardRequested).toBe(false)
  })

  it('shows a sign-in CTA only when the run gate requires sign-in', async () => {
    const store = usePartnerNodesEducationStore()
    renderCard()
    store.requestCard()
    await nextTick()
    expect(
      screen.queryByTestId('partner-nodes-education-sign-in')
    ).not.toBeInTheDocument()

    __setGate('sign-in')
    await nextTick()
    expect(
      screen.getByTestId('partner-nodes-education-sign-in')
    ).toBeInTheDocument()
  })

  it('opens the partner sign-in dialog with the loaded model names', async () => {
    const store = usePartnerNodesEducationStore()
    __setGate('sign-in')
    renderCard()
    store.requestCard()
    await nextTick()

    await userEvent.click(screen.getByTestId('partner-nodes-education-sign-in'))
    expect(showApiNodesSignInDialog).toHaveBeenCalledWith(['Kling'])
  })

  it('makes only one clip audible at a time', async () => {
    const store = usePartnerNodesEducationStore()
    renderCard()
    store.requestCard()
    await nextTick()

    const [openBtn, partnerBtn] = screen.getAllByLabelText(
      new RegExp(`${copy.mute}|${copy.unmute}`)
    )
    expect(openBtn).toHaveAccessibleName(copy.unmute)
    expect(partnerBtn).toHaveAccessibleName(copy.unmute)

    await userEvent.click(openBtn)
    expect(openBtn).toHaveAccessibleName(copy.mute)
    expect(partnerBtn).toHaveAccessibleName(copy.unmute)

    await userEvent.click(partnerBtn)
    expect(openBtn).toHaveAccessibleName(copy.unmute)
    expect(partnerBtn).toHaveAccessibleName(copy.mute)

    await userEvent.click(partnerBtn)
    expect(partnerBtn).toHaveAccessibleName(copy.unmute)
  })
})
