// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import PricingSection from './PricingSection.vue'

describe('PricingSection', () => {
  it('lists every GPU tier with its hourly rate and credit price', () => {
    render(PricingSection)

    for (const [gpu, price] of [
      ['RTX 5090', '$1.58/hr'],
      ['RTX PRO 6000', '$3.49/hr'],
      ['H100', '$4.79/hr'],
      ['H200', '$5.93/hr'],
      ['B200', '$8.64/hr']
    ]) {
      expect(screen.getByText(gpu)).toBeTruthy()
      expect(screen.getByText(price)).toBeTruthy()
    }
  })

  it('lists every storage tier', () => {
    render(PricingSection)

    expect(screen.getByText('$0.091/GB/mo')).toBeTruthy()
    expect(screen.getByText('$0.065/GB/mo')).toBeTruthy()
    expect(screen.getByText('$0.182/GB/mo')).toBeTruthy()
    expect(screen.getByText('$0.13/GB/mo')).toBeTruthy()
  })

  it('falls back to the catalog heading and subtitle', () => {
    render(PricingSection)

    expect(screen.getByRole('heading', { name: 'Pricing' })).toBeTruthy()
  })

  it('lets the host page override the heading, subtitle and note', () => {
    render(PricingSection, {
      props: {
        heading: 'What it costs',
        subtitle: 'Billed per second.',
        note: 'Beta rates.'
      }
    })

    expect(screen.getByRole('heading', { name: 'What it costs' })).toBeTruthy()
    expect(screen.getByText('Billed per second.')).toBeTruthy()
    expect(screen.getByText('Beta rates.')).toBeTruthy()
  })

  it('omits the note when the host page does not supply one', () => {
    render(PricingSection)

    expect(screen.queryByText('Beta rates.')).toBeNull()
  })

  it('localizes the table headers', () => {
    render(PricingSection, { props: { locale: 'zh-CN' } })

    expect(screen.getByRole('columnheader', { name: 'GPU' })).toBeTruthy()
    expect(screen.getByText('RTX 5090')).toBeTruthy()
  })
})
