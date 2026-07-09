import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import AssetOwnerBadge from '@/platform/assets/components/AssetOwnerBadge.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderBadge(name: string) {
  return render(AssetOwnerBadge, {
    props: { owner: { name } },
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

describe('AssetOwnerBadge', () => {
  it('shows only the first name', () => {
    renderBadge('Priya Nair')
    expect(screen.getByText('Priya')).toBeInTheDocument()
  })

  it('truncates long first names with an ellipsis', () => {
    renderBadge('Wolfeschlegelstein Hausenberger')
    expect(screen.getByText('Wolfeschlege…')).toBeInTheDocument()
  })
})
