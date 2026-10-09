import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ComfyAgentPricingSection from './ComfyAgentPricingSection.vue'

describe('ComfyAgentPricingSection', () => {
  it.for([
    {
      locale: 'en',
      limit: 'Free monthly allowance',
      href: '/agent/'
    },
    {
      locale: 'zh-CN',
      limit: '每月免费额度',
      href: '/zh-CN/agent/'
    }
  ] as const)(
    'renders the $locale agent limits and links to the agent page',
    ({ locale, limit, href }) => {
      render(ComfyAgentPricingSection, { props: { locale } })

      expect(screen.getByRole('heading', { name: 'Comfy Agent' })).toBeTruthy()
      expect(screen.getByText(limit)).toBeTruthy()
      expect(
        screen
          .getAllByRole('link')
          .some((link) => link.getAttribute('href') === href)
      ).toBe(true)
    }
  )

  it('lists each plan’s concurrent agent requests in the limits table', () => {
    render(ComfyAgentPricingSection)

    const row = screen.getByRole('row', { name: /Agent requests at once/ })
    expect(
      within(row)
        .getAllByRole('cell')
        .slice(1)
        .map((cell) => cell.textContent.trim())
    ).toEqual(['4', '6', '8', '16'])
  })

  it('states the free monthly allowance in the allowance card', () => {
    render(ComfyAgentPricingSection)

    expect(
      screen.getByText(/gets \$0\.70 of free Comfy Agent usage/)
    ).toBeTruthy()
  })
})
