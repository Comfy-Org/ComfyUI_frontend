// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ManagedBuildsFeaturesSection from './ManagedBuildsFeaturesSection.vue'

function hrefFor(name: string | RegExp) {
  return screen.getByRole('link', { name }).getAttribute('href')
}

describe('ManagedBuildsFeaturesSection', () => {
  it('renders all six managed-build cards', () => {
    render(ManagedBuildsFeaturesSection)

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6)
  })

  it('links the Models API and Serverless API cards at their product pages', () => {
    render(ManagedBuildsFeaturesSection)

    expect(hrefFor('partner models')).toBe('/platform/models')
    expect(hrefFor('Serverless API')).toBe('/platform/serverless')
  })

  it('localizes the card links', () => {
    render(ManagedBuildsFeaturesSection, { props: { locale: 'zh-CN' } })

    expect(hrefFor('合作伙伴模型')).toBe('/zh-CN/platform/models')
    expect(hrefFor('Serverless API')).toBe('/zh-CN/platform/serverless')
  })

  it('links the builder note at the Builder page', () => {
    render(ManagedBuildsFeaturesSection)

    expect(hrefFor(/Builder/)).toBe('/platform/builder')
  })
})
