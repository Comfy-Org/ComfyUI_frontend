import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import ModelStatsOverlay from '@/components/load3d/menubar/ModelStatsOverlay.vue'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

describe('ModelStatsOverlay', () => {
  it('lists every statistic with locale-formatted counts', () => {
    render(ModelStatsOverlay, {
      props: {
        stats: { vertices: 25921, edges: 51520, triangles: 51200 }
      },
      global: { plugins: [i18n] }
    })

    expect(screen.getAllByRole('term').map((el) => el.textContent)).toEqual([
      'Vertices',
      'Edges',
      'Triangles'
    ])
    expect(
      screen.getAllByRole('definition').map((el) => el.textContent)
    ).toEqual(['25,921', '51,520', '51,200'])
  })
})
