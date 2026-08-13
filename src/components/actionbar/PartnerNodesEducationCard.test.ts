import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import * as partnerNodesInGraphModule from '@/composables/node/usePartnerNodesInGraph'
import * as executionErrorStoreModule from '@/stores/executionErrorStore'
import { usePartnerNodesEducationStore } from '@/stores/partnerNodesEducationStore'

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

vi.mock('@/stores/executionErrorStore', async () => {
  const { computed, reactive, ref } = await import('vue')
  const isOpen = ref(false)
  const store = reactive({
    isErrorOverlayOpen: computed(() => isOpen.value)
  })
  return {
    useExecutionErrorStore: () => store,
    __setErrorOverlayOpen: (open: boolean) => {
      isOpen.value = open
    }
  }
})

const { __setErrorOverlayOpen } =
  executionErrorStoreModule as typeof executionErrorStoreModule & {
    __setErrorOverlayOpen: (open: boolean) => void
  }
const { __setHasPartnerNodes } =
  partnerNodesInGraphModule as typeof partnerNodesInGraphModule & {
    __setHasPartnerNodes: (value: boolean) => void
  }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close' },
      partnerNodesEducation: {
        title: 'This template uses partner nodes',
        body: 'Partner nodes run on third-party services, so they use credits, the only paid part of Comfy.',
        gotIt: 'Got it'
      }
    }
  }
})

const CARD_TESTID = 'partner-nodes-education-card'

let pinia: ReturnType<typeof createPinia>

function renderCard() {
  return render(PartnerNodesEducationCard, {
    global: { plugins: [pinia, i18n] }
  })
}

describe('PartnerNodesEducationCard', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    __setErrorOverlayOpen(false)
    __setHasPartnerNodes(true)
  })

  it('stays hidden until a paid template load requests it', () => {
    renderCard()
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()
  })

  it('shows when requested and dismisses via Got it', async () => {
    const store = usePartnerNodesEducationStore()
    renderCard()

    store.requestCard()
    await nextTick()
    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('partner-nodes-education-got-it'))
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()
    expect(store.isCardRequested).toBe(false)
  })

  it('dismisses via the close button', async () => {
    const store = usePartnerNodesEducationStore()
    renderCard()
    store.requestCard()
    await nextTick()

    await userEvent.click(screen.getByTestId('partner-nodes-education-dismiss'))
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()
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

  it('defers to the error overlay and appears once it clears', async () => {
    const store = usePartnerNodesEducationStore()
    __setErrorOverlayOpen(true)
    renderCard()

    store.requestCard()
    await nextTick()
    expect(screen.queryByTestId(CARD_TESTID)).not.toBeInTheDocument()

    __setErrorOverlayOpen(false)
    await nextTick()
    expect(screen.getByTestId(CARD_TESTID)).toBeInTheDocument()
  })
})
