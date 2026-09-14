// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { getRoutes } from '../../config/routes'
import { modelReleaseLinks } from '../../config/model-release-links'
import ModelReleaseSection from './ModelReleaseSection.vue'

const enabled = ref(true)
vi.mock(import('../../scripts/posthog'), () => ({
  useWorkshopEnabled: () => enabled
}))

beforeEach(() => {
  enabled.value = true
})

const enabledLinks = await modelReleaseLinks(true)

// Inactive slides are aria-hidden, so role queries only reach the first
// slide and the pagination dots; the other slides are asserted by text.
describe('ModelReleaseSection', () => {
  it('renders the four model slides with enabled canonical CTAs', async () => {
    render(ModelReleaseSection, {
      props: { modelLinks: enabledLinks }
    })
    await nextTick()

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

  it('localizes copy and enabled routes for zh-CN', async () => {
    render(ModelReleaseSection, {
      props: { locale: 'zh-CN', modelLinks: enabledLinks }
    })
    await nextTick()

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

  it('keeps public links until enabled and restores them when disabled', async () => {
    enabled.value = false
    render(ModelReleaseSection, { props: { modelLinks: enabledLinks } })
    const explore = screen.getByRole('link', { name: 'Explore Seedance 2.5' })
    expect(explore.getAttribute('href')).toBe('/seedance-2.5')
    enabled.value = true
    await nextTick()
    expect(explore.getAttribute('href')).toBe(enabledLinks['seedance-2-5'])
    enabled.value = false
    await nextTick()
    expect(explore.getAttribute('href')).toBe('/seedance-2.5')
  })
})
