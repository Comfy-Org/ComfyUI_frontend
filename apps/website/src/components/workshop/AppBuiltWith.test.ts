import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import type { WorkshopModel } from '@/config/models-catalogue'
import { useWorkshopFlag, useWorkshopWorkflowsEnabled } from '@/scripts/posthog'
import AppBuiltWith from './AppBuiltWith.vue'

vi.mock(import('@/scripts/posthog'))

const model: WorkshopModel = {
  slug: 'byteplus--seedream-5-pro--generate-images',
  name: 'Seedream 5.0 Pro Text-to-Image',
  href: '/hub/models/seedream-5-0-pro-text-to-image/',
  routerId: 'seedream',
  workflowCount: 0,
  capabilities: [],
  task: 'text-to-image'
}
const workflow: WorkshopModel = {
  slug: 'workflows/video-from-references',
  name: 'Make a video from references',
  href: '/hub/workflows/video-from-references/',
  workflowId: 'workflows/video-from-references',
  type: 'CLOUD',
  workflowCount: 0,
  capabilities: []
}
const workflowsOpen = ref(true)

beforeEach(() => {
  workflowsOpen.value = true
  vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(
    readonly(workflowsOpen)
  )
  vi.mocked(useWorkshopFlag).mockReturnValue(readonly(ref(false)))
})

describe('AppBuiltWith', () => {
  it('links each model and workflow behind the app, saying which is which', () => {
    render(AppBuiltWith, { props: { parts: [model, workflow] } })

    const section = screen.getByRole('region', { name: 'Built with' })
    const cards = within(section).getAllByTestId('explore-result')
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      model.href,
      workflow.href
    ])
    expect(
      within(section)
        .getAllByTestId('explore-kind')
        .map((tag) => tag.dataset.kind)
    ).toEqual(['model', 'workflow'])
  })

  it('leaves out workflows while Workflows access is off', () => {
    workflowsOpen.value = false
    render(AppBuiltWith, { props: { parts: [model, workflow] } })

    expect(screen.getAllByTestId('explore-result')).toHaveLength(1)
  })

  it('leaves out a model behind a flag that is off, and says nothing when none is left', () => {
    render(AppBuiltWith, {
      props: { parts: [{ ...model, flag: 'workshop-model-seedream' }] }
    })

    expect(screen.queryByRole('region', { name: 'Built with' })).toBeNull()
  })
})
