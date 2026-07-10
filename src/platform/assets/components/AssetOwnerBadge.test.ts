import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { Directive } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import AssetOwnerBadge from '@/platform/assets/components/AssetOwnerBadge.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const tooltipDirective: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.dataset.tooltip = binding.value
  }
}

function renderBadge(name: string) {
  return render(AssetOwnerBadge, {
    props: { owner: { name } },
    global: { plugins: [i18n], directives: { tooltip: tooltipDirective } }
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

  it('identifies the owner in the tooltip', () => {
    renderBadge('Priya Nair')

    expect(screen.getByText('Priya')).toHaveAttribute(
      'data-tooltip',
      'Shared by Priya Nair'
    )
  })
})
