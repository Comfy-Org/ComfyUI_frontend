// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import type { WorkshopModelDetail } from '../../config/models-catalogue'
import ModelDetail from './ModelDetail.vue'

vi.mock<unknown>(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  return {
    useWorkshopAuthFlag: () => ref(true),
    useWorkshopAuthFlagSettled: () => ref(true)
  }
})

vi.mock<unknown>(import('../../config/workshop-session-state'), async () => {
  const { ref } = await import('vue')
  return {
    useWorkshopSession: () => ({
      user: ref(null),
      session: ref(undefined),
      sessionFailure: ref(undefined),
      settled: ref(true),
      signedIn: ref(false),
      ensureFresh: vi.fn(),
      remint: vi.fn(),
      signOut: vi.fn()
    })
  }
})

vi.mock<unknown>(import('../../config/workshop-credits'), async () => {
  const { ref } = await import('vue')
  return {
    useWorkshopCredits: () => ({
      balance: ref({ status: 'unknown' }),
      session: ref(undefined)
    }),
    refreshWorkshopCredits: vi.fn()
  }
})

const model: WorkshopModelDetail = {
  slug: 'demo',
  name: 'Demo',
  workflowCount: 1,
  href: '/models/demo/',
  routerId: 'demo/demo',
  capabilities: [],
  provider: 'Demo',
  modality: 'image',
  task: 'text-to-image',
  creditsPerRun: 8,
  nodeDisplayName: 'Demo Text to Image',
  fields: [
    {
      kind: 'text',
      name: 'prompt',
      label: 'Prompt',
      multiline: true,
      required: true
    }
  ],
  defaults: {},
  examples: []
}

describe('ModelDetail on the server', () => {
  it('arrives with its playground already rendered, since a browser global read at setup would empty the island', async () => {
    expect(typeof window, 'this file must run without a window').toBe(
      'undefined'
    )

    const html = await renderToString(
      createSSRApp({ render: () => h(ModelDetail, { model }) })
    )

    expect(html).toContain('Playground')
    expect(html).toContain('Prompt')
  })
})
