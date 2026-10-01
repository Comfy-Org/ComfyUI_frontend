import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, within } from '@testing-library/vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { computed, markRaw, readonly, ref, shallowRef } from 'vue'

import { subscribeToWorkshopBuyCredits } from '../../config/workshop-buy-credits'
import { useWorkshopModelBalance } from '../../config/workshop-model-balance'
import type { WorkshopSession } from '../../config/workshop-session-state'
import { useWorkshopSession } from '../../config/workshop-session-state'
import { WorkshopWorkflowError } from '../../config/workshop-workflow-api'
import type { WorkflowState } from '../../config/workshop-workflow-state'
import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import { useWorkflowRun } from '../../composables/useWorkflowRun'
import {
  captureWorkshopEvent,
  useWorkshopEnabled,
  useWorkshopWorkflowsEnabled
} from '../../scripts/posthog'
import WorkflowPlayground from './WorkflowPlayground.vue'

vi.mock(import('../../config/workshop-session-state'))
vi.mock(import('../../config/workshop-credits'))
vi.mock(import('../../config/workshop-model-balance'), () => ({
  useWorkshopModelBalance: vi.fn()
}))
vi.mock(import('../../composables/useWorkflowRun'))
vi.mock(import('../../scripts/posthog'))

beforeEach(() => {
  vi.mocked(useWorkshopModelBalance).mockReturnValue(
    computed(() => ({ status: 'unknown' }))
  )
  mockWorkflowRun()
})

function mockWorkflowRun(state = shallowRef<WorkflowState>({ phase: 'idle' })) {
  vi.mocked(useWorkflowRun).mockReturnValue({
    state,
    analytics: computed(() => undefined),
    identitySettled: computed(() => true),
    signedIn: computed(() => Boolean(useWorkshopSession().session.value)),
    observation: computed(() =>
      'observation' in state.value ? state.value.observation : undefined
    ),
    start: async () => {},
    resume: async () => {},
    cancel: async () => {},
    dismiss: () => {},
    retryDelivery: async () => {},
    refreshOutput: () => undefined
  })
  return state
}

function session(role: WorkshopSession['role']): WorkshopSession {
  return {
    uid: 'alice',
    token: 'token',
    expiresAt: Date.now() + 60_000,
    workspace: { id: 'studio', name: 'Studio', type: 'team' },
    role,
    permissions: []
  }
}

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
    const getKey = screen.getByRole('link', { name: 'Get API key' })
    getKey.addEventListener('click', (event) => event.preventDefault(), {
      once: true
    })
    await visitor.click(getKey)
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
      name: 'api_key_clicked',
      properties: expect.objectContaining({
        model_slug: model.slug,
        page_type: 'workflow',
        workflow_id: model.workflowId
      })
    })
  })

  it('reports snippet copies with the language and workflow attribution', async () => {
    const fixture = workflowDetailsBySlug.get(
      'workflows/animate-reference-sheet'
    )
    assert(fixture)
    const model = markRaw(fixture)
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(true)))
    render(WorkflowPlayground, { props: { model, scope: 'anonymous' } })
    const visitor = userEvent.setup()
    await visitor.click(screen.getByRole('tab', { name: 'API' }))
    await visitor.click(screen.getByRole('tab', { name: 'Python' }))
    await visitor.click(screen.getByRole('button', { name: 'Copy snippet' }))
    expect(captureWorkshopEvent).toHaveBeenLastCalledWith({
      name: 'api_snippet_copied',
      properties: expect.objectContaining({
        model_slug: model.slug,
        page_type: 'workflow',
        workflow_id: model.workflowId,
        snippet_language: 'python'
      })
    })
  })

  it('reports no API key clicks or snippet copies while Workflows is off', async () => {
    const fixture = workflowDetailsBySlug.get(
      'workflows/animate-reference-sheet'
    )
    assert(fixture)
    vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(ref(true)))
    vi.mocked(useWorkshopWorkflowsEnabled).mockReturnValue(readonly(ref(false)))
    render(WorkflowPlayground, {
      props: { model: markRaw(fixture), scope: 'anonymous' }
    })
    const visitor = userEvent.setup()
    await visitor.click(screen.getByRole('tab', { name: 'API' }))
    await visitor.click(screen.getByRole('button', { name: 'Copy snippet' }))
    const getKey = screen.getByRole('link', { name: 'Get API key' })
    getKey.addEventListener('click', (event) => event.preventDefault(), {
      once: true
    })
    await visitor.click(getKey)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
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
      vi.mocked(useWorkshopModelBalance).mockReturnValue(
        computed(() => ({ status: 'ok', credits }))
      )

      render(WorkflowPlayground, {
        props: { model, scope: JSON.stringify(['alice', 'studio']) }
      })

      expect(screen.getByTestId('workflow-run')).toHaveAccessibleName(action)
    }
  )

  it('opens credits once when an owner run is refused and leaves the action available', async () => {
    const model = workflowDetailsBySlug.get('workflows/remove-background')
    assert(model)
    const purchase = vi.fn()
    onTestFinished(subscribeToWorkshopBuyCredits(purchase))
    useWorkshopSession().session = computed(() => session('owner'))
    const credits = ref(1_200)
    vi.mocked(useWorkshopModelBalance).mockReturnValue(
      computed(() => ({ status: 'ok', credits: credits.value }))
    )
    const state = mockWorkflowRun()

    render(WorkflowPlayground, {
      props: { model, scope: JSON.stringify(['alice', 'studio']) }
    })
    state.value = {
      phase: 'failed',
      error: new WorkshopWorkflowError('insufficient_credits')
    }

    await waitFor(() => expect(purchase).toHaveBeenCalledOnce())
    expect(screen.getByTestId('workflow-run')).toHaveAccessibleName(
      'Add credits'
    )
    credits.value = 1_100
    state.value = {
      phase: 'failed',
      error: new WorkshopWorkflowError('insufficient_credits')
    }
    await waitFor(() => expect(purchase).toHaveBeenCalledOnce())

    await userEvent.setup().click(screen.getByTestId('workflow-run'))
    expect(purchase).toHaveBeenCalledTimes(2)
  })

  it('keeps a member credit refusal on the switch-workspace path', async () => {
    const model = workflowDetailsBySlug.get('workflows/remove-background')
    assert(model)
    const purchase = vi.fn()
    onTestFinished(subscribeToWorkshopBuyCredits(purchase))
    useWorkshopSession().session = computed(() => session('member'))
    const state = mockWorkflowRun()

    render(WorkflowPlayground, {
      props: { model, scope: JSON.stringify(['alice', 'studio']) }
    })
    state.value = {
      phase: 'failed',
      error: new WorkshopWorkflowError('insufficient_credits')
    }

    await waitFor(() =>
      expect(screen.getByTestId('workflow-run')).toHaveAccessibleName(
        'Switch to personal workspace'
      )
    )
    expect(purchase).not.toHaveBeenCalled()
  })
})
