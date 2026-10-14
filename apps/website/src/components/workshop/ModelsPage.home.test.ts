import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { workshopModels } from '@/config/workshop-browse-content'
import './ModelsCatalogue.vue'
import { HUB_HOME_FLAG } from '@/lib/workshop/hub-section'
import {
  useWorkshopAppsEnabled,
  useWorkshopAuthFlag,
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopFlag,
  useWorkshopWorkflowsEnabled
} from '@/scripts/posthog'
import ModelsPage from './ModelsPage.vue'

vi.mock(import('@/scripts/posthog'))

let homeEnabled: Ref<boolean>

beforeEach(() => {
  homeEnabled = ref(false)
  vi.mocked(useWorkshopFlag).mockImplementation((name) =>
    readonly(name === HUB_HOME_FLAG ? homeEnabled : ref(false))
  )
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(false)))
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopAuthFlag).mockReturnValue(readonly(ref(false)))
  vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(false)))
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(ref(false)))
  respondToFetch('/models/catalogue.json', () => Response.json(workshopModels))
})

const renderHome = () =>
  render(ModelsPage, {
    props: { section: 'explore' as const, heading: 'What will you make?' },
    slots: { fallback: '<h1>Public showcase</h1>' }
  })

describe('Hub home', () => {
  it('reads the public showcase while its flag is closed', async () => {
    renderHome()

    expect(await screen.findByText('Public showcase')).toBeTruthy()
    expect(screen.queryByTestId('explore-home')).toBeNull()
    expect(screen.queryByTestId('workshop-heading')).toBeNull()
  })

  it('opens the doors once the flag answers for this visitor', async () => {
    homeEnabled.value = true
    renderHome()

    expect(await screen.findByTestId('explore-home')).toBeTruthy()
    expect(screen.getByTestId('explore-doors')).toBeTruthy()
    expect(screen.queryByText('Public showcase')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'What will you make?'
    )
  })
})
