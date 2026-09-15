import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/scripts/app'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import { setWorkflowDefaultView } from './builderViewOptions'

const mockTrackDefaultViewSet = vi.hoisted(() => vi.fn())

vi.mock(import('@/i18n'), () => ({ t: (key: string) => key }))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({ trackDefaultViewSet: mockTrackDefaultViewSet })
}))

vi.mock<unknown>(import('@/scripts/app'), () => {
  const rootGraph = { extra: {} }
  return { app: { rootGraph, rootGraphOrUndefined: rootGraph } }
})

describe('setWorkflowDefaultView', () => {
  beforeEach(() => {
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

  it('calls changeTracker.captureCanvasState', () => {
    const workflow = createMockLoadedWorkflow()
    setWorkflowDefaultView(workflow, true)
    expect(workflow.changeTracker.captureCanvasState).toHaveBeenCalledOnce()
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
