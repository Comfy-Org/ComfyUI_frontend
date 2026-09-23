import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@/platform/telemetry'
import { app } from '@/scripts/app'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

import { setWorkflowDefaultView } from './builderViewOptions'

vi.mock(import('@/i18n'), () => ({ t: (key: string) => key }))

vi.mock(import('@/platform/telemetry'))

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
    expect(useTelemetry()?.trackDefaultViewSet).toHaveBeenCalledWith({
      default_view: 'app'
    })

    setWorkflowDefaultView(workflow, false)
    expect(useTelemetry()?.trackDefaultViewSet).toHaveBeenCalledWith({
      default_view: 'graph'
    })
  })
})
