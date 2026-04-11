import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import type { setWorkflowDefaultView as SetWorkflowDefaultViewFn } from './builderViewOptions'

const mockTrackDefaultViewSet = vi.hoisted(() => vi.fn())

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackDefaultViewSet: mockTrackDefaultViewSet })
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { extra: {} } }
}))

describe('setWorkflowDefaultView', () => {
  let setWorkflowDefaultView: typeof SetWorkflowDefaultViewFn
  let app: { rootGraph: { extra: Record<string, unknown> } }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./builderViewOptions')
    setWorkflowDefaultView = mod.setWorkflowDefaultView
    app = (await import('@/scripts/app')).app as typeof app
    app.rootGraph.extra = {}
  })

  it('sets initialMode to app when openAsApp is true', () => {
    const workflow = createMockLoadedWorkflow({ initialMode: undefined })
    setWorkflowDefaultView(workflow, true)
    expect(workflow.initialMode).toBe('app')
  })

  it('sets initialMode to graph when openAsApp is false', () => {
    const workflow = createMockLoadedWorkflow({ initialMode: undefined })
    setWorkflowDefaultView(workflow, false)
    expect(workflow.initialMode).toBe('graph')
  })

  it('sets linearMode on rootGraph.extra', () => {
    const workflow = createMockLoadedWorkflow()
    setWorkflowDefaultView(workflow, true)
    expect(app.rootGraph.extra.linearMode).toBe(true)

    setWorkflowDefaultView(workflow, false)
    expect(app.rootGraph.extra.linearMode).toBe(false)
  })

  it('calls changeTracker.checkState', () => {
    const workflow = createMockLoadedWorkflow()
    setWorkflowDefaultView(workflow, true)
    expect(workflow.changeTracker.checkState).toHaveBeenCalledOnce()
  })

  it('tracks telemetry with correct default_view', () => {
    const workflow = createMockLoadedWorkflow()
    setWorkflowDefaultView(workflow, true)
    expect(mockTrackDefaultViewSet).toHaveBeenCalledWith({
      default_view: 'app'
    })

    setWorkflowDefaultView(workflow, false)
    expect(mockTrackDefaultViewSet).toHaveBeenCalledWith({
      default_view: 'graph'
    })
  })
})
