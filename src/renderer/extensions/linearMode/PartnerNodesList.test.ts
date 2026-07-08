import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import PartnerNodesList from '@/renderer/extensions/linearMode/PartnerNodesList.vue'
import { toNodeId } from '@/types/nodeId'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderList(
  badges: readonly (readonly [string, string, ReturnType<typeof toNodeId>])[]
) {
  return render(PartnerNodesList, {
    props: { badges },
    global: { plugins: [i18n] }
  })
}

describe('PartnerNodesList', () => {
  it('pairs each priced node title with its own credit cost, in order', () => {
    const badges = [
      ['Flux Pro Ultra', '99.9 credits/Run', toNodeId(1)],
      ['Kling Video', '250 credits/Run', toNodeId(2)]
    ] as const
    renderList(badges)

    const breakdown = screen.getByRole('list', {
      name: enMessages.linearMode.creditBreakdown
    })
    const rows = within(breakdown).getAllByRole('listitem')
    expect(rows).toHaveLength(badges.length)

    badges.forEach(([title, price], i) => {
      expect(within(rows[i]).getByText(title)).toBeInTheDocument()
      expect(within(rows[i]).getByText(price)).toBeInTheDocument()
    })
  })
})
