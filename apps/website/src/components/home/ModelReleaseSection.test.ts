// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { getRoutes } from '../../config/routes'
import { modelReleaseLinks } from '../../config/model-release-links'
import ModelReleaseSection from './ModelReleaseSection.vue'

const enabledLinks = await modelReleaseLinks(true)

// Inactive slides are aria-hidden, so role queries only reach the first
// slide and the pagination dots; the other slides are asserted by text.
describe('ModelReleaseSection', () => {
  it('renders the four model slides with enabled canonical CTAs', () => {
    render(ModelReleaseSection, {
      props: { modelLinks: enabledLinks }
    })

    expect(screen.getByText('Seedance 2.5', { selector: 'h2' })).toBeTruthy()
    expect(screen.getByText('LTX 2.5', { selector: 'h2' })).toBeTruthy()
    expect(screen.getByText('Wan Animate 2', { selector: 'h2' })).toBeTruthy()
    expect(screen.getByText('MiniMax H3', { selector: 'h2' })).toBeTruthy()

    const explore = screen.getByRole('link', { name: 'Explore Seedance 2.5' })
    expect(explore.getAttribute('href')).toBe(
      '/models/byteplus--seedance-2-5-text-to-video--generate-videos/'
    )

    const tryCta = screen.getByRole('link', { name: 'Try Workflow' })
    expect(tryCta.getAttribute('href')).toBe(
      '/models/byteplus--seedance-2-5-text-to-video--generate-videos/'
    )
    expect(tryCta.getAttribute('target')).toBeNull()

    expect(screen.getAllByText('Partner Nodes').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Open Weights').length).toBeGreaterThan(0)
  })

  it('localizes copy and enabled routes for zh-CN', () => {
    render(ModelReleaseSection, {
      props: { locale: 'zh-CN', modelLinks: enabledLinks }
    })

    expect(screen.getAllByText('新模型发布').length).toBeGreaterThan(0)

    const explore = screen.getByRole('link', { name: '探索 Seedance 2.5' })
    expect(explore.getAttribute('href')).toBe(
      '/models/byteplus--seedance-2-5-text-to-video--generate-videos/'
    )

    expect(screen.getByRole('link', { name: '试用工作流' })).toBeTruthy()
    expect(screen.getAllByText('合作伙伴节点').length).toBeGreaterThan(0)
  })

  it.for(['en', 'zh-CN'] as const)(
    'preserves the release and Cloud destinations without the compile flag in %s',
    (locale) => {
      render(ModelReleaseSection, { props: { locale } })
      const explore = screen.getByRole('link', {
        name: /^(Explore|探索) Seedance 2.5$/
      })
      expect(explore.getAttribute('href')).toBe(getRoutes(locale).seedance)
      const tryCta = screen.getByRole('link', {
        name: /^(Try Workflow|试用工作流)$/
      })
      expect(tryCta.getAttribute('href')).toBe(
        'https://cloud.comfy.org/?template=api_seedance2_5_r2v'
      )
      expect(tryCta.getAttribute('target')).toBe('_blank')
    }
  )
})
