// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessWorkerAnimation from './ServerlessWorkerAnimation.vue'

describe('ServerlessWorkerAnimation', () => {
  it('describes the diagram for assistive tech', () => {
    render(ServerlessWorkerAnimation, { props: { locale: 'en' } })

    expect(
      screen.getByRole('img', {
        name: t('platform.serverlessVisual.ariaLabel', 'en')
      })
    ).toBeTruthy()
  })

  it('renders the 12x5 activity grid', () => {
    const { container } = render(ServerlessWorkerAnimation, {
      props: { locale: 'en' }
    })

    const grid = container.querySelector('.grid-cols-12')
    expect(grid).toBeTruthy()
    expect(grid?.children).toHaveLength(12 * 5)
  })

  it('labels the three workers', () => {
    render(ServerlessWorkerAnimation, { props: { locale: 'en' } })

    expect(
      screen.getAllByText(t('platform.serverlessVisual.worker', 'en'))
    ).toHaveLength(3)
  })
})
