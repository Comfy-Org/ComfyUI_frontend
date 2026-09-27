import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'
import WorkflowPlayground from './WorkflowPlayground.vue'

vi.mock(import('../../config/workshop-session-state'))
vi.mock(import('../../scripts/posthog'))

describe('WorkflowPlayground analytics', () => {
  it('reports page and API visits under Models event names with workflow attribution after access is enabled', async () => {
    const model = workflowDetailsBySlug.get('workflows/remove-background')
    assert(model)
    const enabled = ref(false)
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(enabled))
    render(WorkflowPlayground, { props: { model, scope: 'anonymous' } })
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
    enabled.value = true
    await waitFor(() => expect(captureWorkshopEvent).toHaveBeenCalledOnce())
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
      name: 'model_viewed',
      properties: expect.objectContaining({
        model_slug: model.slug,
        page_type: 'workflow',
        render_engine: 'cloud',
        workflow_id: model.workflowId
      })
    })
    await userEvent.setup().click(screen.getByRole('tab', { name: 'API' }))
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
      name: 'api_viewed',
      properties: expect.objectContaining({
        page_type: 'workflow',
        render_engine: 'cloud'
      })
    })
    expect(
      vi.mocked(captureWorkshopEvent).mock.calls.map(([event]) => event.name)
    ).toEqual(['model_viewed', 'api_viewed'])
  })
})
