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
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
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

function setActiveWorkflow(key: string) {
  useWorkflowStore().activeWorkflow = { key } as LoadedComfyWorkflow
}

/** Load a paid template: it becomes the active workflow and requests the card. */
function loadPaidTemplate(workflowKey: string) {
  setActiveWorkflow(workflowKey)
  usePartnerNodesEducationStore().requestCard(workflowKey)
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
    renderCard()

    loadPaidTemplate('paid-wf')
    await nextTick()
    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument()
    expect(screen.getByText(copy.pitch)).toBeInTheDocument()
  })

  it('dismisses via the close button', async () => {
    renderCard()
    loadPaidTemplate('paid-wf')
    await nextTick()

    await userEvent.click(screen.getByTestId('partner-nodes-education-dismiss'))
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()
  })

  it('survives partner nodes registering after the request (template load)', async () => {
    const store = usePartnerNodesEducationStore()
    __setHasPartnerNodes(false)
    renderCard()
    loadPaidTemplate('paid-wf')
    await nextTick()

    __setHasPartnerNodes(true)
    await nextTick()
    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument()
    expect(store.isCardRequested).toBe(true)
  })

  it('hides when the graph no longer contains partner nodes', async () => {
    renderCard()
    loadPaidTemplate('paid-wf')
    await nextTick()
    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument()

    __setHasPartnerNodes(false)
    await nextTick()
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()
  })

  it('hides when a different workflow becomes active, even one with partner nodes', async () => {
    renderCard()
    loadPaidTemplate('paid-wf')
    await nextTick()
    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument()

    setActiveWorkflow('other-wf')
    await nextTick()
    expect(
      screen.queryByTestId(CARD_TESTID),
      'card must not describe a workflow the user has left'
    ).not.toBeInTheDocument()
  })

  it('stays hidden when the request resolves after the user already switched away', async () => {
    renderCard()
    setActiveWorkflow('other-wf')
    usePartnerNodesEducationStore().requestCard('paid-wf')
    await nextTick()
    expect(
      screen.queryByTestId(CARD_TESTID),
      'a request for a workflow the user already left must never show'
    ).not.toBeInTheDocument()
  })

  it('shows a sign-in CTA only when the run gate requires sign-in', async () => {
    renderCard()
    loadPaidTemplate('paid-wf')
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
    __setGate('sign-in')
    renderCard()
    loadPaidTemplate('paid-wf')
    await nextTick()

    await userEvent.click(screen.getByTestId('partner-nodes-education-sign-in'))
    expect(showApiNodesSignInDialog).toHaveBeenCalledWith(['Kling'])
  })

  it('gives each audio toggle a distinct, side-specific accessible name', async () => {
    renderCard()
    loadPaidTemplate('paid-wf')
    await nextTick()

    const openBtn = screen.getByRole('button', { name: copy.unmuteOpen })
    const partnerBtn = screen.getByRole('button', { name: copy.unmutePartner })
    expect(openBtn).not.toBe(partnerBtn)

    await userEvent.click(openBtn)
    expect(openBtn).toHaveAccessibleName(copy.muteOpen)
    expect(partnerBtn).toHaveAccessibleName(copy.unmutePartner)

    await userEvent.click(partnerBtn)
    expect(openBtn).toHaveAccessibleName(copy.unmuteOpen)
    expect(partnerBtn).toHaveAccessibleName(copy.mutePartner)
  })
})
