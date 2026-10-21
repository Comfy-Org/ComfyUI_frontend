// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, readonly, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import type { RouterWorkshopModelDetail } from '@/config/models-catalogue'
import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled,
  useWorkshopFlag
} from '@/scripts/posthog'
import ModelPageSwitch from './ModelPageSwitch.vue'

vi.mock(import('@/scripts/posthog'))
vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/config/workshop-credits'))

const model: RouterWorkshopModelDetail = {
  slug: 'demo',
  name: 'Demo',
  workflowCount: 1,
  href: '/models/demo/',
  routerId: 'demo/demo',
  capabilities: [],
  provider: 'Demo',
  modality: 'image',
  fields: [],
  defaults: {},
  examples: []
}

describe('the model page on the server', () => {
  it('renders the published page even for a visitor whose flag is already on, so hydration matches', async () => {
    vi.mocked(useWorkshopFlag).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(ref(true)))

    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(ModelPageSwitch, {
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
          })
      })
    )

    expect(html).toContain('data-testid="model-hero"')
    expect(html).not.toContain('data-testid="model-trail"')
  })
})
