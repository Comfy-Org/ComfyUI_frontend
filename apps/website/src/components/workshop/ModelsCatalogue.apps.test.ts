import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import { HUB_HOME_FLAG } from '@/lib/workshop/hub-section'
import {
  useWorkshopAppsEnabled,
  useWorkshopEnabled,
  useWorkshopFlag
} from '@/scripts/posthog'
import ModelsCatalogue from './ModelsCatalogue.vue'

vi.mock(import('@/scripts/posthog'))

let hubHome: Ref<boolean>

const apps: WorkshopModel[] = [
  {
    type: 'APP',
    appId: 'studio',
    slug: 'cinematic-studio',
    name: 'Cinematic Studio',
    href: '/hub/apps/cinematic-studio/',
    workflowCount: 0,
    capabilities: [],
    useCases: []
  }
]

beforeEach(() => {
  history.replaceState(null, '', '/hub/apps/')
  hubHome = ref(false)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopFlag).mockImplementation((name) =>
    readonly(name === HUB_HOME_FLAG ? hubHome : ref(true))
  )
})

const renderApps = () =>
  render(ModelsCatalogue, { props: { models: apps, section: 'apps' } })

describe('the Apps half of the catalogue', () => {
  it('keeps the catalogue that is published today while the flag is closed', async () => {
    renderApps()

    expect(await screen.findByTestId('workshop-toolbar')).toBeTruthy()
    expect(screen.queryByTestId('app-grid')).toBeNull()
  })

  it('swaps in the Hub catalogue once the flag answers for this visitor', async () => {
    hubHome.value = true
    renderApps()

    expect(await screen.findByTestId('app-grid')).toBeTruthy()
    expect(screen.queryByTestId('workshop-toolbar')).toBeNull()
  })
})
