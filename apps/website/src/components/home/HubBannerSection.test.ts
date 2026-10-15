import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { hubBannerContent } from '@/data/hubBanner'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopFlag,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import HubBannerSection from './HubBannerSection.vue'

vi.mock(import('@/scripts/posthog'))

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
  it('leads with three entries into the open Hub sections by default', async () => {
    renderBanner()

    expect(
      await screen.findByRole('heading', {
        name: 'Everything you need to make it'
      })
    ).toBeVisible()
    expect(screen.getByTestId('home-hub-banner')).toHaveAttribute(
      'data-design',
      'entries'
    )
    expect(
      screen.getByRole('link', { name: 'Explore the Hub' })
    ).toHaveAttribute('href', '/hub/')
    expect(sectionLinks()).toEqual([
      [
        'AppsUpload, click, done. No nodes, no setup.See all apps',
        '/hub/apps/'
      ],
      [
        'WorkflowsRun it in Comfy Cloud, then change any step.See all workflows',
        '/hub/workflows/'
      ],
      [
        'ModelsCall the latest models through one API.See all models',
        '/hub/models/'
      ]
    ])
  })

  it('shows each entry with an image from its own catalogue', async () => {
    renderBanner()

    await screen.findByTestId('home-hub-banner')
    for (const [id, tiles] of [
      ['apps', hubBannerContent.apps],
      ['workflows', hubBannerContent.workflows],
      ['models', hubBannerContent.models]
    ] as const)
      expect(
        within(screen.getByTestId(`home-hub-entry-${id}`)).getByTestId(
          'home-hub-entry-image'
        )
      ).toHaveAttribute('src', tiles[0]?.imageUrl)
  })

  it('leaves out the entries whose sections are closed', async () => {
    flags({ apps: false, workflows: false })
    renderBanner()

    await screen.findByTestId('home-hub-banner')
    expect(sectionLinks().map(([, href]) => href)).toEqual(['/hub/models/'])
  })

  it('speaks Chinese on the zh-CN homepage', async () => {
    renderBanner('zh-CN')

    expect(
      await screen.findByRole('link', { name: '探索 Hub' })
    ).toHaveAttribute('href', '/hub/')
    expect(
      within(screen.getByTestId('home-hub-entry-workflows')).getByText('工作流')
    ).toBeVisible()
  })
})
