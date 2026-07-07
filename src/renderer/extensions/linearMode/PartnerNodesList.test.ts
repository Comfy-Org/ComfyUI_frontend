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
  it('lists each priced node with its title and credit cost', () => {
    renderList([
      ['Flux Pro Ultra', '99.9 credits/Run', toNodeId(1)],
      ['Kling Video', '250 credits/Run', toNodeId(2)]
    ])

    const breakdown = screen.getByRole('list', {
      name: enMessages.linearMode.creditBreakdown
    })
    expect(within(breakdown).getByText('Flux Pro Ultra')).toBeInTheDocument()
    expect(within(breakdown).getByText('99.9 credits/Run')).toBeInTheDocument()
    expect(within(breakdown).getByText('Kling Video')).toBeInTheDocument()
    expect(within(breakdown).getByText('250 credits/Run')).toBeInTheDocument()
    expect(within(breakdown).getAllByRole('listitem')).toHaveLength(2)
  })
})
