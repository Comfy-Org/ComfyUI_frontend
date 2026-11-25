import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  classifyWorkflowContent,
  reportWorkflowStateAnomaly,
  resetReportedWorkflowStateAnomaliesForTests
} from './comfyWorkflow'

const mockAssert = vi.hoisted(() => vi.fn())

vi.mock(import('@/base/assert'), () => ({
  assert: mockAssert
}))

const workflow = {
  path: 'workflows/private-name.json',
  isLoaded: false,
  isPersisted: true,
  isTemporary: false,
  changeTracker: null,
  initialState: null,
  activeState: null,
  originalContent: 'null'
}

describe('classifyWorkflowContent', () => {
  it.for([
    [null, 'unavailable'],
    [undefined, 'unavailable'],
    ['', 'empty'],
    ['  \n', 'empty'],
    ['null', 'null'],
    ['{"nodes":[]}', 'object'],
    ['[]', 'other'],
    ['42', 'other'],
    ['"text"', 'other'],
    ['{not json', 'unparseable']
  ] as const)('classifies %j as %s', ([content, kind]) => {
    expect(classifyWorkflowContent(content)).toBe(kind)
  })
})

describe('reportWorkflowStateAnomaly', () => {
  beforeEach(() => {
    resetReportedWorkflowStateAnomaliesForTests()
  })

  it('reports a static message with a structural context', () => {
    reportWorkflowStateAnomaly('Something is missing', 'site.one', workflow, {
      isActive: true
    })

    expect(mockAssert).toHaveBeenCalledExactlyOnceWith(
      false,
      'Something is missing',
      {
        method: 'site.one',
        isLoaded: false,
        hasChangeTracker: false,
        hasInitialState: false,
        hasActiveState: false,
        isPersisted: true,
        isTemporary: false,
        originalContentKind: 'null',
        isActive: true
      }
    )
  })

  it('never sends the workflow path or content', () => {
    reportWorkflowStateAnomaly('Something is missing', 'site.one', workflow)

    expect(JSON.stringify(mockAssert.mock.calls)).not.toContain('private-name')
  })

  it('reports only the method when there is no workflow', () => {
    reportWorkflowStateAnomaly('Something is missing', 'site.two', undefined, {
      hasFirst: false
    })

    expect(mockAssert).toHaveBeenCalledWith(false, 'Something is missing', {
      method: 'site.two',
      hasFirst: false
    })
  })

  it('reports a given site and workflow once', () => {
    reportWorkflowStateAnomaly('Something is missing', 'site.one', workflow)
    reportWorkflowStateAnomaly('Something is missing', 'site.one', workflow)
    reportWorkflowStateAnomaly('Something is missing', 'site.two', workflow)
    reportWorkflowStateAnomaly('Something is missing', 'site.one', {
      ...workflow,
      path: 'workflows/other.json'
    })

    expect(mockAssert).toHaveBeenCalledTimes(3)
  })
})
