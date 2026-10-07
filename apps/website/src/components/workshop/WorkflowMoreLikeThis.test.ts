import { render, screen, within } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import { useWorkshopFlag } from '@/scripts/posthog'
import WorkflowMoreLikeThis from './WorkflowMoreLikeThis.vue'

vi.mock(import('@/scripts/posthog'))

const model = workflowDetailsBySlug.get('workflows/remove-background')
assert(model, 'the catalogue no longer carries the fixture workflow')

function entry(slug: string, useCase: string, flag?: string) {
  return {
    slug: `workflows/${slug}`,
    name: slug,
    href: `/hub/workflows/${slug}/`,
    workflowId: slug,
    type: 'CLOUD',
    workflowCount: 0,
    capabilities: [],
    useCases: [useCase],
    modality: useCase.endsWith('images') ? 'image' : 'video',
    ...(flag ? { flag } : {})
  }
}

describe('WorkflowMoreLikeThis', () => {
  it('lists the shown workflows near this one from the catalogue', async () => {
    vi.mocked(useWorkshopFlag).mockImplementation((flag) =>
      readonly(ref(flag !== 'off-flag'))
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json([
          entry('remove-background', 'edit-images'),
          entry('restore-portrait', 'edit-images'),
          entry('hidden-one', 'edit-images', 'off-flag'),
          entry('upscale-video', 'edit-videos')
        ])
      )
    )
    render(WorkflowMoreLikeThis, { props: { model } })

    const row = await screen.findByRole('region', { name: 'More like this' })
    expect(
      within(row)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
    ).toEqual(['/hub/workflows/restore-portrait/'])
  })

  it('shows nothing when the catalogue cannot be read', async () => {
    const read = vi.fn(async () => Response.error())
    vi.stubGlobal('fetch', read)
    render(WorkflowMoreLikeThis, { props: { model } })

    await vi.waitFor(() => expect(read).toHaveBeenCalled())
    expect(screen.queryByRole('region')).toBeNull()
  })
})
