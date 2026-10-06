// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, readonly, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import type { WorkshopModelDetail } from '@/config/models-catalogue'
import { workshopContract } from '@/config/workshop-contract-catalog'
import { useWorkshopEnabled } from '@/scripts/posthog'
import ModelDetail from './ModelDetail.vue'

vi.mock(import('@/scripts/posthog'))
vi.mock(import('@/config/workshop-session-state'))
vi.mock(import('@/config/workshop-credits'))

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
  examples: [],
  execution: workshopContract('bfl/flux-2-pro')
}

describe('ModelDetail on the server', () => {
  it('arrives with its playground already rendered, since a browser global read at setup would empty the island', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    expect(typeof window, 'this file must run without a window').toBe(
      'undefined'
    )

    const html = await renderToString(
      createSSRApp({ render: () => h(ModelDetail, { model }) })
    )

    expect(html).toContain('Playground')
    expect(html).toContain('Prompt')
  })

  it('renders the same run area whatever the flag says, so a cached flag cannot break hydration', async () => {
    vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', '1')
    const render = async (enabled: boolean) => {
      vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(enabled)))
      return renderToString(
        createSSRApp({ render: () => h(ModelDetail, { model }) })
      )
    }

    const flagOff = await render(false)

    expect(flagOff).toContain('data-gate="resolving"')
    expect(await render(true)).toBe(flagOff)
  })

  it('arrives with its inputs disabled, since hydration would discard anything typed first', async () => {
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))

    const html = await renderToString(
      createSSRApp({ render: () => h(ModelDetail, { model }) })
    )

    const prompt = /<textarea[^>]*data-testid="field-prompt"[^>]*>/.exec(html)
    expect(prompt?.[0]).toMatch(/\sdisabled(?=[\s=>])/)
  })
})
