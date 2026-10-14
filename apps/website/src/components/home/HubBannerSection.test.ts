import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { workshopModels } from '@/config/workshop-browse-content'
import { workflowModels } from '@/config/workshop-workflow-content'
import { hubBannerContent } from '@/data/hubBanner'
import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopFlag,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import HubBannerSection from './HubBannerSection.vue'

vi.mock(import('@/scripts/posthog'))

const catalogueHrefs = new Set(
  [...workflowModels, ...workshopModels].map((model) => model.href)
)

function flags({ apps = true, workflows = true } = {}) {
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopFlag).mockReturnValue(readonly(ref(false)))
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(ref(apps)))
  vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(
    readonly(ref(workflows))
  )
}

beforeEach(() => {
  setPreviewSwitch('home-hub-pick-remix-run', false)
  window.localStorage.clear()
  flags()
})

const renderBanner = (locale: 'en' | 'zh-CN' = 'en') =>
  render(HubBannerSection, { props: { content: hubBannerContent, locale } })

const sectionLinks = () =>
  within(screen.getByRole('navigation', { name: 'Hub sections' }))
    .getAllByRole('link')
    .map((link) => [link.textContent.trim(), link.getAttribute('href')])

describe('HubBannerSection', () => {
  it('shows the mosaic banner by default', async () => {
    renderBanner()

    expect(
      await screen.findByRole('heading', {
        name: 'Everything you need to make it'
      })
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Explore the Hub' })
    ).toHaveAttribute('href', '/hub/')
    expect(sectionLinks()).toEqual([
      ['Apps', '/hub/apps/'],
      ['Workflows', '/hub/workflows/'],
      ['Partner models', '/hub/models/']
    ])
  })

  it('fills the mosaic with catalogue images only', async () => {
    renderBanner()

    const sources = (await screen.findAllByTestId('home-hub-mosaic-image')).map(
      (image) => image.getAttribute('src')
    )
    const catalogueImages = new Set(
      [...hubBannerContent.models, ...hubBannerContent.workflows].map(
        (tile) => tile.imageUrl
      )
    )
    expect(sources.length).toBeGreaterThan(3)
    expect(sources.every((src) => catalogueImages.has(src ?? ''))).toBe(true)
  })

  it('switches to Pick · Remix · Run when the preview switch is on', async () => {
    setPreviewSwitch('home-hub-pick-remix-run', true)
    renderBanner()

    expect(await screen.findByTestId('home-hub-banner')).toHaveAttribute(
      'data-design',
      'pick-remix-run'
    )
    expect(sectionLinks()).toEqual([
      ['PICKApps', '/hub/apps/'],
      ['REMIXWorkflows', '/hub/workflows/'],
      ['RUNPartner models', '/hub/models/']
    ])
    expect(
      screen.getByRole('link', { name: 'Explore the Hub' })
    ).toHaveAttribute('href', '/hub/')
  })

  it('links every Pick · Remix · Run tile to a real workflow or model page', async () => {
    setPreviewSwitch('home-hub-pick-remix-run', true)
    renderBanner()

    const showcase = await screen.findByRole('region', {
      name: 'Workflows and models in the Hub'
    })
    const tiles = within(showcase).getAllByRole('link')
    expect(tiles.length).toBeGreaterThan(0)
    for (const tile of tiles) {
      expect(catalogueHrefs.has(tile.getAttribute('href') ?? '')).toBe(true)
      expect(tile).toHaveAccessibleName(/\S.*(Workflow|Model) · \S/)
    }
  })

  it('keeps closed sections as plain words without a link or tiles', async () => {
    flags({ apps: false, workflows: false })
    setPreviewSwitch('home-hub-pick-remix-run', true)
    renderBanner()

    await screen.findByTestId('home-hub-banner')
    expect(sectionLinks()).toEqual([['RUNPartner models', '/hub/models/']])
    expect(screen.getByTestId('home-hub-lane-apps').tagName).toBe('SPAN')
    const tileHrefs = screen
      .getAllByTestId('home-hub-tile')
      .map((tile) => tile.getAttribute('href'))
    expect(tileHrefs.every((href) => href?.startsWith('/hub/models/'))).toBe(
      true
    )
  })

  it('speaks Chinese on the zh-CN homepage', async () => {
    setPreviewSwitch('home-hub-pick-remix-run', true)
    renderBanner('zh-CN')

    expect(
      await screen.findByRole('link', { name: '探索 Hub' })
    ).toHaveAttribute('href', '/hub/')
    expect(screen.getByText('挑选')).toBeVisible()
  })
})
