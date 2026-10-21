import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, inject, nextTick, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { RouterWorkshopModelDetail } from '@/config/models-catalogue'
import { HUB_HOME_FLAG } from '@/lib/workshop/hub-section'
import { LIVE_PAGE_HELD } from '@/lib/workshop/live-page-hold'
import { useWorkshopEnabledSettled, useWorkshopFlag } from '@/scripts/posthog'
import ModelPageSwitch from './ModelPageSwitch.vue'

vi.mock(import('@/scripts/posthog'))

const heldSeen: boolean[] = []

const PublishedPageStub = defineComponent({
  props: { page: { type: Object, required: true } },
  setup() {
    const held = inject(LIVE_PAGE_HELD, ref(false))
    watch(held, (value) => heldSeen.push(value), { immediate: true })
    return () =>
      h('div', {
        'data-testid': 'published-model-page',
        'data-held': String(held.value)
      })
  }
})

let hubHome: Ref<boolean>
let flagsSettled: Ref<boolean>

beforeEach(() => {
  heldSeen.length = 0
  hubHome = ref(false)
  flagsSettled = ref(true)
  vi.mocked(useWorkshopFlag).mockImplementation((name) =>
    readonly(name === HUB_HOME_FLAG ? hubHome : ref(false))
  )
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(flagsSettled))
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
        ModelPage: PublishedPageStub,
        HubModelPage: { template: '<div data-testid="hub-model-page" />' }
      }
    }
  })

describe('the model page', () => {
  it('keeps the page that is published today while the flag is closed', async () => {
    renderSwitch()

    const published = await screen.findByTestId('published-model-page')
    expect(published).toHaveAttribute('data-held', 'false')
    expect(screen.queryByTestId('hub-model-page')).toBeNull()
  })

  it('swaps in the Hub page once the flag answers after the page is up', async () => {
    renderSwitch()
    await screen.findByTestId('published-model-page')

    hubHome.value = true

    expect(await screen.findByTestId('hub-model-page')).toBeTruthy()
    expect(screen.queryByTestId('published-model-page')).toBeNull()
  })

  it('keeps the Hub page once chosen, even while the flag is asked again', async () => {
    hubHome.value = true
    renderSwitch()
    await screen.findByTestId('hub-model-page')

    hubHome.value = false
    await nextTick()
    expect(screen.getByTestId('hub-model-page')).toBeTruthy()

    hubHome.value = true
    await nextTick()
    expect(screen.getByTestId('hub-model-page')).toBeTruthy()
    expect(screen.queryByTestId('published-model-page')).toBeNull()
  })

  it('holds the published page back until the flag has answered', async () => {
    flagsSettled.value = false
    renderSwitch()
    const published = await screen.findByTestId('published-model-page')
    expect(published).toHaveAttribute('data-held', 'true')

    flagsSettled.value = true
    await nextTick()

    expect(published).toHaveAttribute('data-held', 'false')
  })

  it('never lets a visitor bound for the Hub page restore or report on the published one', async () => {
    flagsSettled.value = false
    renderSwitch()
    await screen.findByTestId('published-model-page')

    hubHome.value = true
    flagsSettled.value = true

    await screen.findByTestId('hub-model-page')
    expect(heldSeen.length).toBeGreaterThan(0)
    expect(heldSeen).not.toContain(false)
  })
})
