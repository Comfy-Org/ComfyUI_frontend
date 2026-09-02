// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ServerlessVisual from './ServerlessVisual.vue'

describe('ServerlessVisual', () => {
  it('labels the worker fleet with each GPU class', () => {
    render(ServerlessVisual, { props: { locale: 'en' } })

    for (const gpu of ['RTX 6000 PRO', 'H100', 'B200']) {
      expect(screen.getByText(gpu)).toBeTruthy()
    }
  })

  it('describes the diagram for assistive tech', () => {
    render(ServerlessVisual, { props: { locale: 'en' } })

    expect(
      screen.getByRole('img', { name: /RTX 6000 PRO, H100, and B200/ })
    ).toBeTruthy()
  })
})
