// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ModelReleaseSection from './ModelReleaseSection.vue'

// Inactive slides are aria-hidden, so role queries only reach the first
// slide and the pagination dots; the other slides are asserted by text.
describe('ModelReleaseSection', () => {
  it('renders the four model slides with locale-aware CTAs', () => {
    render(ModelReleaseSection)

    expect(screen.getByText('Seedance 2.5', { selector: 'h2' })).toBeTruthy()
    expect(screen.getByText('LTX 2.5', { selector: 'h2' })).toBeTruthy()
    expect(screen.getByText('Wan Animate 2', { selector: 'h2' })).toBeTruthy()
    expect(screen.getByText('MiniMax H3', { selector: 'h2' })).toBeTruthy()

    const explore = screen.getByRole('link', { name: 'Explore Seedance 2.5' })
    expect(explore.getAttribute('href')).toBe('/seedance-2.5')

    const tryCta = screen.getByRole('link', { name: 'Try Workflow' })
    expect(tryCta.getAttribute('href')).toBe(
      'https://cloud.comfy.org/?template=api_seedance2_5_r2v'
    )
    expect(tryCta.getAttribute('target')).toBe('_blank')
    expect(tryCta.getAttribute('rel')).toBe('noopener noreferrer')

    expect(screen.getAllByText('Partner Nodes').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Open Weights').length).toBeGreaterThan(0)
  })

  it('localizes copy and routes for zh-CN', () => {
    render(ModelReleaseSection, { props: { locale: 'zh-CN' } })

    expect(screen.getAllByText('新模型发布').length).toBeGreaterThan(0)

    const explore = screen.getByRole('link', { name: '探索 Seedance 2.5' })
    expect(explore.getAttribute('href')).toBe('/zh-CN/seedance-2.5')

    expect(screen.getByRole('link', { name: '试用工作流' })).toBeTruthy()
    expect(screen.getAllByText('合作伙伴节点').length).toBeGreaterThan(0)
  })
})
