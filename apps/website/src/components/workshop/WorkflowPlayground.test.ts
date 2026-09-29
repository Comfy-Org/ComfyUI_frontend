import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'
import { computed, readonly, ref } from 'vue'

import { useWorkshopCredits } from '../../config/workshop-credits'
import type { WorkshopSession } from '../../config/workshop-session-state'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'
import WorkflowPlayground from './WorkflowPlayground.vue'

vi.mock(import('../../config/workshop-session-state'))
vi.mock(import('../../config/workshop-credits'))
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

describe('WorkflowPlayground API tab analytics', () => {
  it('reports Get API key clicks with workflow attribution', async () => {
    const model = workflowDetailsBySlug.get('workflows/remove-background')
    assert(model)
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(true)))
    render(WorkflowPlayground, { props: { model, scope: 'anonymous' } })
    const visitor = userEvent.setup()
    await visitor.click(screen.getByRole('tab', { name: 'API' }))
    await visitor.click(screen.getByRole('link', { name: 'Get API key' }))
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
      name: 'api_key_clicked',
      properties: expect.objectContaining({
        model_slug: model.slug,
        page_type: 'workflow',
        workflow_id: model.workflowId
      })
    })
  })
})

describe('WorkflowPlayground input panel', () => {
  // The way out of the page lives on Details beside the graph, so the panel
  // that asks the questions carries the run control and nothing else.
  it('heads the questions and leaves the ways out to Details', () => {
    const model = workflowDetailsBySlug.get('workflows/remove-background')
    assert(model)
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(true)))
    render(WorkflowPlayground, {
      props: { model, scope: 'anonymous', cloudHref: 'https://cloud/?t=1' }
    })

    const panel = screen.getByRole('tabpanel', { name: 'Playground' })
    expect(panel).toHaveTextContent('Input')
    expect(
      within(panel).queryByRole('link', { name: 'Try in Cloud' })
    ).toBeNull()
  })
})

describe('WorkflowPlayground primary action', () => {
  it.for([
    { role: 'owner' as const, credits: 40, action: 'Run' },
    { role: 'owner' as const, credits: 0, action: 'Add credits' },
    {
      role: 'member' as const,
      credits: 0,
      action: 'Switch to personal workspace'
    }
  ])(
    'offers $action to a signed-in $role with $credits credits',
    ({ role, credits, action }) => {
      const model = workflowDetailsBySlug.get('workflows/remove-background')
      assert(model)
      vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
      vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(
        readonly(ref(true))
      )
      const owner: WorkshopSession = {
        uid: 'alice',
        token: 'token',
        expiresAt: Date.now() + 60_000,
        workspace: { id: 'studio', name: 'Studio', type: 'team' },
        role,
        permissions: []
      }
      useWorkshopSession().session = computed(() => owner)
      const balance = useWorkshopCredits()
      balance.balance = computed(() => ({ status: 'ok', credits }))
      balance.session = computed(() => owner)

      render(WorkflowPlayground, {
        props: { model, scope: JSON.stringify(['alice', 'studio']) }
      })

      expect(screen.getByTestId('workflow-run')).toHaveAccessibleName(action)
    }
  )
})
