import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { hubBannerContent } from '@/data/hubBanner'
import { discoveryProviders } from '@/data/modelDiscovery'
import { HUB_HOME_FLAG } from '@/lib/workshop/hub-section'
import { setPreviewSwitch } from '@/lib/workshop/preview-switches'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopFlag,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import HomeHubSection from './HomeHubSection.vue'

vi.mock(import('@/scripts/posthog'))

let hubHome: Ref<boolean>

beforeEach(() => {
  setPreviewSwitch('home-hub-pick-remix-run', false)
  window.localStorage.clear()
  hubHome = ref(false)
  vi.mocked(useWorkshopFlag).mockImplementation((name) =>
    readonly(name === HUB_HOME_FLAG ? hubHome : ref(false))
  )
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(true)))
})

const renderSection = () =>
  render(HomeHubSection, {
    props: {
      content: hubBannerContent,
      providers: discoveryProviders,
      workflows: []
    }
  })

describe('the Hub section on the home page', () => {
  it('keeps the section that is published today while the flag is closed', async () => {
    renderSection()

    expect(await screen.findByTestId('model-discovery')).toBeTruthy()
    expect(screen.queryByTestId('home-hub-banner')).toBeNull()
  })

  it('swaps in the new banner once the flag answers for this visitor', async () => {
    hubHome.value = true
    renderSection()

    expect(await screen.findByTestId('home-hub-banner')).toBeTruthy()
    expect(screen.queryByTestId('model-discovery')).toBeNull()
  })
})
