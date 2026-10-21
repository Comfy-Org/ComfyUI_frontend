import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { ProviderModelRow } from '@/config/models-page-data'
import ProviderModelsTable from './ProviderModelsTable.vue'

const row = (slug: string, fields: Partial<ProviderModelRow> = {}) => ({
  slug,
  name: slug,
  href: `/hub/models/${slug}/`,
  provider: 'Acme',
  ...fields
})

function cells() {
  return screen.getAllByTestId('provider-model-row').map((tr) =>
    within(tr)
      .getAllByRole('cell')
      .map((cell) => cell.textContent.trim())
  )
}

describe('ProviderModelsTable', () => {
  it('names the provider and lists each model with its price, resolution and duration', () => {
    render(ProviderModelsTable, {
      props: {
        provider: 'Acme',
        rows: [
          row('painter', {
            price: '~9.5 credits/Image',
            resolution: '1K – 2K'
          }),
          row('director', {
            resolution: '480p – 4K',
            duration: { min: 4, max: 30 }
          }),
          row('clip', { duration: { min: 5, max: 5 } }),
          row('open', { duration: { max: 15 } })
        ]
      }
    })

    expect(
      screen.getByRole('heading', { level: 2, name: 'More from Acme' })
    ).toBeTruthy()
    expect(
      screen.getAllByRole('columnheader').map((th) => th.textContent.trim())
    ).toEqual(['Model', 'Price', 'Resolution', 'Duration'])
    expect(cells()).toEqual([
      ['~9.5 credits/Image', '1K – 2K', '—'],
      ['—', '480p – 4K', '4 – 30s'],
      ['—', '—', '5s'],
      ['—', '—', 'up to 15s']
    ])
    expect(screen.getByRole('link', { name: 'director' })).toHaveAttribute(
      'href',
      '/hub/models/director/'
    )
  })

  it('stays hidden without other models', () => {
    render(ProviderModelsTable, { props: { provider: 'Acme', rows: [] } })

    expect(screen.queryByTestId('related-models')).toBeNull()
  })
})
