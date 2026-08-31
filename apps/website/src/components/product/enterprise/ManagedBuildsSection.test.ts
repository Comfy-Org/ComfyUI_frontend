// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ManagedBuildsSection from './ManagedBuildsSection.vue'

describe('ManagedBuildsSection', () => {
  it('links to the Managed Builds page and to sales', () => {
    render(ManagedBuildsSection, { props: { locale: 'en' } })

    expect(
      screen
        .getByRole('link', { name: 'Explore Managed Builds' })
        .getAttribute('href')
    ).toBe('/enterprise/managed-builds')
    expect(
      screen.getByRole('link', { name: 'Contact sales' }).getAttribute('href')
    ).toBe('/contact')
  })

  it('renders the three teaser cards in the admin-control order', () => {
    render(ManagedBuildsSection, { props: { locale: 'en' } })

    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent?.trim())
    expect(titles).toEqual([
      'Open Source Models',
      'Partner Models',
      'Easy Installation'
    ])
  })

  it('localizes labels and links for zh-CN', () => {
    render(ManagedBuildsSection, { props: { locale: 'zh-CN' } })

    expect(screen.getByRole('heading', { name: '托管构建' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: '了解托管构建' }).getAttribute('href')
    ).toBe('/zh-CN/enterprise/managed-builds')
    expect(
      screen.getByRole('link', { name: '联系销售' }).getAttribute('href')
    ).toBe('/zh-CN/contact')
  })
})

// The Partner Models card flattens description + link label + suffix into one
// sentence, so the separators must come from the copy, not from markup.
describe('ManagedBuildsSection partner models copy', () => {
  it('reads as a complete sentence in English', () => {
    render(ManagedBuildsSection, { props: { locale: 'en' } })

    expect(
      screen.getByText(
        'Dynamically control which partner models are available to your team (e.g. Seedance, GPT-Image-2). Run models with your own key (BYOK).'
      )
    ).toBeTruthy()
  })

  it('reads as a complete sentence in zh-CN, which needs no spaces', () => {
    render(ManagedBuildsSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByText(
        '动态控制团队可以使用哪些合作伙伴模型（如 Seedance、GPT-Image-2），还可以用你自己的密钥运行模型（BYOK）。'
      )
    ).toBeTruthy()
  })
})
