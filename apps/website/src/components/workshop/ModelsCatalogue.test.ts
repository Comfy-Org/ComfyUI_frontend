// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import type { WorkshopModel } from '../../config/models-catalogue'
import ModelsCatalogue from './ModelsCatalogue.vue'

const models: WorkshopModel[] = [
  {
    slug: 'kling-ai',
    name: 'Kling AI',
    workflowCount: 3,
    href: '/models/kling-ai/',
    routerId: 'kling/kling-ai',
    capabilities: [],
    runs: 12_000,
    provider: 'Kling',
    modality: 'video',
    task: 'text-to-video'
  },
  {
    slug: 'flux',
    name: 'Flux',
    workflowCount: 2,
    href: '/models/flux/',
    routerId: 'bfl/flux',
    capabilities: [],
    runs: 8_000,
    provider: 'Black Forest Labs',
    modality: 'image',
    task: 'text-to-image'
  }
]

const { version } = usePrototypeTweaks()

afterEach(() => {
  version.value = 'v1'
})

describe('ModelsCatalogue', () => {
  it('starts on the models catalog and swaps to the V2 screen when the tweak asks', async () => {
    render(ModelsCatalogue, { props: { models: [] } })
    expect(screen.getByTestId('workshop-hero')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hub')).toBeNull()

    version.value = 'v2'
    await nextTick()
    expect(screen.getByTestId('workshop-hub')).toBeTruthy()
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
  })

  it('opens the whole catalogue from the hero, whatever was searched', async () => {
    const user = userEvent.setup()
    version.value = 'v1.1'
    render(ModelsCatalogue, { props: { models } })

    const search = screen.getByTestId<HTMLInputElement>('workshop-search')
    await user.type(search, 'flux')
    expect(screen.getAllByTestId('workshop-model-card')).toHaveLength(1)

    await user.click(screen.getByTestId('browse-all'))

    expect(search.value).toBe('')
    expect(screen.getAllByTestId('workshop-model-card')).toHaveLength(
      models.length
    )
    expect(screen.queryByTestId('workshop-hero')).toBeNull()
  })
})
