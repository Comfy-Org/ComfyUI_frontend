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

const models: WorkshopModel[] = [
  {
    slug: 'acme--aster--generate-images',
    name: 'Aster Image',
    href: '/hub/models/aster/',
    routerId: 'acme/aster',
    workflowCount: 1,
    capabilities: [],
    provider: 'Acme',
    useCases: ['generate-images']
  }
]

beforeEach(() => {
  history.replaceState(null, '', '/hub/models/')
  hubHome = ref(false)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopAppsEnabled).mockReturnValue(readonly(ref(true)))
  vi.mocked(useWorkshopFlag).mockImplementation((name) =>
    readonly(name === HUB_HOME_FLAG ? hubHome : ref(false))
  )
})

const renderModels = () =>
  render(ModelsCatalogue, { props: { models, section: 'models' } })

describe('the Models half of the catalogue', () => {
  it('keeps the catalogue that is published today while the flag is closed', () => {
    const { emitted } = renderModels()

    expect(screen.getByTestId('workshop-hero')).toBeTruthy()
    expect(screen.queryByTestId('models-hub-hero')).toBeNull()
    expect(emitted('hero')).toEqual([[false]])
  })

  it('swaps in the Hub catalogue and its own heading once the flag answers for this visitor', async () => {
    hubHome.value = true
    const { emitted } = renderModels()

    expect(await screen.findByTestId('models-hub-hero')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
    expect(emitted('hero')).toEqual([[false], [true]])
  })
})
