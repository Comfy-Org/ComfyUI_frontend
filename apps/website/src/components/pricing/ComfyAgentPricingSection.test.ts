import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ComfyAgentPricingSection from './ComfyAgentPricingSection.vue'

describe('ComfyAgentPricingSection', () => {
  it.for([
    {
      locale: 'en',
      limit: 'Billed in Comfy Credits',
      href: '/agent/'
    },
    {
      locale: 'zh-CN',
      limit: '使用 Comfy Credits 计费',
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
        .map((cell) => cell.textContent.trim())
    ).toEqual(['4', '6', '8', '16'])
  })
})
