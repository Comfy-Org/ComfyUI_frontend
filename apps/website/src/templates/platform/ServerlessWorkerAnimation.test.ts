import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessWorkerAnimation from './ServerlessWorkerAnimation.vue'

describe('ServerlessWorkerAnimation', () => {
  it('describes the diagram for assistive tech', () => {
    render(ServerlessWorkerAnimation, { props: { locale: 'en' } })

    expect(
      screen.getByRole('img', {
        name: t('platform.serverlessVisual.ariaLabel', {}, { locale: 'en' })
      })
    ).toBeTruthy()
  })

  it('renders the 12x5 activity grid', () => {
    render(ServerlessWorkerAnimation, {
      props: { locale: 'en' }
    })

    expect(screen.getAllByTestId('activity-cell')).toHaveLength(12 * 5)
  })

  it('labels the three workers', () => {
    render(ServerlessWorkerAnimation, { props: { locale: 'en' } })

    expect(
      screen.getAllByText(
        t('platform.serverlessVisual.worker', {}, { locale: 'en' })
      )
    ).toHaveLength(3)
  })
})
