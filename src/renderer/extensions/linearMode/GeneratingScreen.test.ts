import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { InProgressItem } from '@/renderer/extensions/linearMode/linearModeTypes'
import { ResultItemImpl } from '@/stores/queueStore'

import GeneratingScreen from './GeneratingScreen.vue'

const state = vi.hoisted(() => ({
  cards: [] as InProgressItem[],
  status: null as string | null,
  percent: 0
}))

vi.mock('@/renderer/extensions/linearMode/useExecutionStatus', async () => {
  const { computed } = await import('vue')
  return {
    useExecutionStatus: () => ({
      executionStatusMessage: computed(() => state.status)
    })
  }
})

vi.mock('@/composables/queue/useQueueProgress', async () => {
  const { computed } = await import('vue')
  return {
    useQueueProgress: () => ({ totalPercent: computed(() => state.percent) })
  }
})

vi.mock('@/renderer/extensions/linearMode/linearOutputStore', async () => {
  const { computed, reactive } = await import('vue')
  return {
    useLinearOutputStore: () =>
      reactive({ generatingCards: computed(() => state.cards) })
  }
})

vi.mock('@/renderer/extensions/linearMode/GeneratingCard.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: {
        card: { type: Object, required: true },
        depth: { type: Number, required: true },
        total: { type: Number, required: true }
      },
      setup: (props) => () =>
        h('div', {
          'data-testid': 'gen-card',
          'data-id': props.card.id,
          'data-depth': props.depth,
          'data-total': props.total
        })
    })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function imageCard(id: string, seq: number, withOutput = true): InProgressItem {
  return {
    id,
    jobId: 'j',
    seq,
    state: 'image',
    output: withOutput
      ? new ResultItemImpl({
          filename: `${id}.png`,
          subfolder: '',
          type: 'output',
          nodeId: '1',
          mediaType: 'images'
        })
      : undefined
  }
}

function renderScreen() {
  return render(GeneratingScreen, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  state.cards = []
  state.status = null
  state.percent = 0
})

describe('GeneratingScreen', () => {
  it('fans only cards that have something to show, newest painted last', () => {
    state.cards = [
      imageCard('a', 5),
      imageCard('b', 4, false),
      { id: 'c', jobId: 'j', seq: 3, state: 'latent', latentPreviewUrl: 'u' },
      { id: 'd', jobId: 'j', seq: 2, state: 'latent' },
      { id: 'e', jobId: 'j', seq: 1, state: 'skeleton' }
    ]
    renderScreen()

    const cards = screen.getAllByTestId('gen-card')
    // Skeletons and preview-less latents are dropped; the remaining two render
    // oldest-first so the newest (depth 0) paints on top.
    expect(cards.map((c) => c.getAttribute('data-id'))).toEqual(['c', 'a'])
    expect(cards.map((c) => c.getAttribute('data-depth'))).toEqual(['1', '0'])
    expect(cards.every((c) => c.getAttribute('data-total') === '2')).toBe(true)
  })

  it('falls back to the generating status when none is reported', () => {
    renderScreen()
    expect(screen.getByRole('status').textContent).toContain('Generating')
  })

  it('shows the reported execution status', () => {
    state.status = 'Rendering nodes'
    renderScreen()
    expect(screen.getByRole('status').textContent).toContain('Rendering nodes')
  })

  it('reflects queue progress on the progressbar', () => {
    state.percent = 42.6
    renderScreen()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '43'
    )
  })

  it('emits stop when the cancel button is pressed', async () => {
    const user = userEvent.setup()
    const { emitted } = renderScreen()
    await user.click(screen.getByTestId('linear-cancel-run'))
    expect(emitted().stop).toHaveLength(1)
  })
})
