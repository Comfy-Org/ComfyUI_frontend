import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueStatusIdle from '@/components/queue/QueueStatusIdle.vue'

import type { RecentResult } from './queueStatusTypes'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      queueStatus: {
        recentResults: 'Recent results',
        viewResult: 'View {name}',
        goToHistoryShort: 'History'
      }
    }
  }
})

const result: RecentResult = {
  id: 'r1',
  job: { id: 'r1', title: 'Flux portrait', meta: '', state: 'completed' },
  name: 'Flux portrait',
  meta: 'Completed · 2:43 PM',
  isVideo: false
}

describe('QueueStatusIdle', () => {
  it('opens the list on its container, not on the first result', async () => {
    render(QueueStatusIdle, {
      props: { label: '0 active', results: [result], open: true },
      global: { plugins: [i18n] }
    })
    await waitFor(() =>
      expect(
        screen.getByRole('group', { name: 'Recent results' })
      ).toHaveFocus()
    )
    expect(
      screen.getByRole('button', { name: 'View Flux portrait' })
    ).not.toHaveFocus()
  })
})
