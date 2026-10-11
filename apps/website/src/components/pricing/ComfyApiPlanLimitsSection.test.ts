import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ComfyApiPlanLimitsSection from './ComfyApiPlanLimitsSection.vue'

describe('ComfyApiPlanLimitsSection', () => {
  it('notes that Enterprise limits are set by contract and links to contact', () => {
    render(ComfyApiPlanLimitsSection, { props: { locale: 'en' } })

    expect(
      screen.getByText('Enterprise limits are determined by your contract.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute(
      'href',
      '/contact/'
    )
  })

  it('translates the Enterprise contract note for zh-CN', () => {
    render(ComfyApiPlanLimitsSection, { props: { locale: 'zh-CN' } })

    expect(screen.getByText('企业版的限制由合同约定。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '联系我们' })).toHaveAttribute(
      'href',
      '/zh-CN/contact/'
    )
  })
})
