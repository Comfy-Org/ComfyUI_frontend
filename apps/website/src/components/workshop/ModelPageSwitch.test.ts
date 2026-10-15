import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import type { RouterWorkshopModelDetail } from '@/config/models-catalogue'
import { HUB_HOME_FLAG } from '@/lib/workshop/hub-section'
import { useWorkshopFlag } from '@/scripts/posthog'
import ModelPageSwitch from './ModelPageSwitch.vue'

vi.mock(import('@/scripts/posthog'))

let hubHome: Ref<boolean>

beforeEach(() => {
  hubHome = ref(false)
  vi.mocked(useWorkshopFlag).mockImplementation((name) =>
    readonly(name === HUB_HOME_FLAG ? hubHome : ref(false))
  )
})

const model: RouterWorkshopModelDetail = {
  slug: 'provider--model--generate-images',
  name: 'Example Model',
  href: '/hub/models/provider--model--generate-images/',
  routerId: 'provider/model',
  workflowCount: 0,
  capabilities: [],
  fields: [],
  examples: [],
  defaults: {}
}

const renderSwitch = () =>
  render(ModelPageSwitch, {
    props: {
      page: {
        model,
        related: [],
        relatedHeading: 'Related models',
        providerModels: [],
        workflows: [],
        shownTags: [],
        restTags: [],
        restTagCount: 0
      }
    },
    global: {
      stubs: {
        ModelPage: { template: '<div data-testid="published-model-page" />' },
        HubModelPage: { template: '<div data-testid="hub-model-page" />' }
      }
    }
  })

describe('the model page', () => {
  it('keeps the page that is published today while the flag is closed', async () => {
    renderSwitch()

    expect(await screen.findByTestId('published-model-page')).toBeTruthy()
    expect(screen.queryByTestId('hub-model-page')).toBeNull()
  })

  it('swaps in the Hub page once the flag answers for this visitor', async () => {
    hubHome.value = true
    renderSwitch()

    expect(await screen.findByTestId('hub-model-page')).toBeTruthy()
    expect(screen.queryByTestId('published-model-page')).toBeNull()
  })
})
