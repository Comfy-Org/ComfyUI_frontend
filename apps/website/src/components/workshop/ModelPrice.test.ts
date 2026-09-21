// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelPrice from './ModelPrice.vue'

describe('ModelPrice', () => {
  it('sets the amount apart from the unit it is charged in', () => {
    render(ModelPrice, { props: { estimate: '8.44 credits/Run' } })
    const price = screen.getByTestId('model-price')
    expect(price.textContent.replace(/\s+/g, ' ').trim()).toBe(
      '8.44 credits/Run'
    )
    expect(screen.getByTestId('info-tooltip')).toBeTruthy()
  })

  it('says the cost varies when no estimate is given, with nothing to explain', () => {
    render(ModelPrice, {})
    expect(screen.getByTestId('model-price').textContent).toContain(
      'Cost depends on your settings'
    )
    expect(screen.queryByTestId('info-tooltip')).toBeNull()
  })
})
