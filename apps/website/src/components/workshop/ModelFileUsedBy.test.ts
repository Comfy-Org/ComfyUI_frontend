import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, readonly, ref } from 'vue'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { useWorkshopFlag, useWorkshopWorkflowsEnabled } from '@/scripts/posthog'
import ModelFileUsedBy from './ModelFileUsedBy.vue'

vi.mock(import('@/scripts/posthog'))

const workflow: WorkflowWorkshopModel = {
  slug: 'workflows/change-material',
  name: 'Change material',
  href: '/hub/workflows/change-material/',
  workflowId: 'workflows/change-material',
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

describe('ModelFileUsedBy', () => {
  it('links each workflow that loads the file', async () => {
    render(ModelFileUsedBy, { props: { workflows: [workflow] } })

    const section = await screen.findByRole('region', {
      name: 'Workflows that use it'
    })
    expect(
      within(section)
        .getAllByRole('link')
        .some((link) => link.getAttribute('href') === workflow.href)
    ).toBe(true)
  })

  it.for([
    { name: 'workflows are hidden', open: false, workflows: [workflow] },
    { name: 'no workflow loads the file', open: true, workflows: [] }
  ])('renders nothing when $name', async ({ open, workflows }) => {
    workflowsOpen.value = open
    render(ModelFileUsedBy, { props: { workflows } })
    await nextTick()

    expect(screen.queryByTestId('model-file-used-by')).toBeNull()
  })
})
