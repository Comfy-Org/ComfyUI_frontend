// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import DeveloperPlatformSection from './DeveloperPlatformSection.vue'

describe('DeveloperPlatformSection', () => {
  it('links the three products and the landing page', () => {
    render(DeveloperPlatformSection, { props: { locale: 'en' } })

    const hrefOf = (name: string) =>
      screen.getByRole('link', { name }).getAttribute('href')
    expect(hrefOf('Serverless API')).toBe('/platform/serverless')
    expect(hrefOf('Models API')).toBe('/platform/models')
    expect(hrefOf('Builder')).toBe('/platform/builder')
    expect(hrefOf('Explore the Developer Platform')).toBe('/platform')
  })

  it('localizes links for zh-CN', () => {
    render(DeveloperPlatformSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByRole('link', { name: '了解开发者平台' }).getAttribute('href')
    ).toBe('/zh-CN/platform')
    expect(
      screen.getByRole('link', { name: 'Builder' }).getAttribute('href')
    ).toBe('/zh-CN/platform/builder')
  })
})
