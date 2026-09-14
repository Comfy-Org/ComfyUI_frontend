// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessImageHeatmapAnimation from './ServerlessImageHeatmapAnimation.vue'

describe('ServerlessImageHeatmapAnimation', () => {
  it('describes the diagram for assistive tech', () => {
    render(ServerlessImageHeatmapAnimation, { props: { locale: 'en' } })

    const stage = screen.getByRole('img', {
      name: t('platform.serverlessVisual.ariaLabel', 'en')
    })
    expect(stage.getAttribute('data-artwork')).toBe('anime')
    expect(stage.getAttribute('data-phase')).toBe('connect')
  })

  it('renders the full 36x14 heatmap grid', () => {
    render(ServerlessImageHeatmapAnimation, {
      props: { locale: 'en' }
    })

    expect(screen.getAllByTestId('heatmap-cell')).toHaveLength(36 * 14)
  })

  it('labels the three workers', () => {
    render(ServerlessImageHeatmapAnimation, { props: { locale: 'en' } })

    expect(
      screen.getAllByText(t('platform.serverlessVisual.worker', 'en'))
    ).toHaveLength(3)
  })
})
