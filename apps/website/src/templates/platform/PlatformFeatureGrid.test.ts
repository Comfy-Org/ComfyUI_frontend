// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import PlatformFeatureGrid from './PlatformFeatureGrid.vue'

const cards = [
  { title: 'Autoscaling', description: 'Scales to zero.' },
  {
    title: 'Partner models',
    // The separator lives in the copy so zh-CN can omit it.
    description: 'Call ',
    link: { label: 'partner models', href: '/platform/models', suffix: ' too.' }
  }
]

describe('PlatformFeatureGrid', () => {
  it('renders a card per feature under the section heading', () => {
    render(PlatformFeatureGrid, { props: { heading: 'What you get', cards } })

    expect(screen.getByRole('heading', { name: 'What you get' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Autoscaling' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Partner models' })).toBeTruthy()
  })

  it('renders an optional subtitle', () => {
    render(PlatformFeatureGrid, {
      props: { heading: 'What you get', subtitle: 'The short version', cards }
    })

    expect(screen.getByText('The short version')).toBeTruthy()
  })

  it('inlines an optional link between the description and its suffix', () => {
    render(PlatformFeatureGrid, { props: { heading: 'What you get', cards } })

    const link = screen.getByRole('link', { name: 'partner models' })
    expect(link.getAttribute('href')).toBe('/platform/models')
    expect(link.parentElement?.textContent).toBe('Call partner models too.')
  })

  it('leaves cards without a link as plain copy', () => {
    render(PlatformFeatureGrid, { props: { heading: 'What you get', cards } })

    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByText('Scales to zero.')).toBeTruthy()
  })

  it('lays out three columns by default', () => {
    render(PlatformFeatureGrid, { props: { heading: 'What you get', cards } })

    expect(document.querySelector('.lg\\:grid-cols-3')).toBeTruthy()
    expect(document.querySelector('.lg\\:grid-cols-4')).toBeNull()
  })

  it('lays out four columns on request', () => {
    render(PlatformFeatureGrid, {
      props: { heading: 'What you get', cards, columns: 4 }
    })

    expect(document.querySelector('.lg\\:grid-cols-4')).toBeTruthy()
  })
})
