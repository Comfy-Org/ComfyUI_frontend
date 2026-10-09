import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ComfyAgentPricingSection from './ComfyAgentPricingSection.vue'

describe('ComfyAgentPricingSection', () => {
  it.for([
    {
      locale: 'en',
      heading: 'Comfy Agent',
      limit: 'Free monthly allowance',
      href: '/agent/'
    },
    {
      locale: 'zh-CN',
      heading: 'Comfy Agent',
      limit: '每月免费额度',
      href: '/zh-CN/agent/'
    }
  ] as const)(
    'renders the $locale agent limits and links to the agent page',
    ({ locale, heading, limit, href }) => {
      render(ComfyAgentPricingSection, { props: { locale } })

      expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
      expect(screen.getByText(limit)).toBeTruthy()
      expect(screen.getByRole('link').getAttribute('href')).toBe(href)
    }
  )
})
