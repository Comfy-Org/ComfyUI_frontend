import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  currentCompletedWorkflowDocumentId,
  notifyWorkflowWarningsReady,
  onWorkflowWarningsReady
} from './workflowLoadEvents'
const mocks = vi.hoisted(() => ({ document: undefined as string | undefined }))
vi.mock('@/platform/nodeApi/appReady', () => ({
  currentDocumentId: () => mocks.document
}))
vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))
beforeEach(() => {
  mocks.document = undefined
  notifyWorkflowWarningsReady()
})
describe('completed workflow identity', () => {
  it('publishes only after warnings are synchronized and invalidates an early new load', () => {
    mocks.document = 'first'
    expect(currentCompletedWorkflowDocumentId()).toBeUndefined()
    notifyWorkflowWarningsReady()
    expect(currentCompletedWorkflowDocumentId()).toBe('first')
    mocks.document = 'second'
    expect(currentCompletedWorkflowDocumentId()).toBeUndefined()
    notifyWorkflowWarningsReady()
    expect(currentCompletedWorkflowDocumentId()).toBe('second')
  })
  it('delivers the completed identity and isolates listener failures', () => {
    const broken = onWorkflowWarningsReady(() => {
      throw new Error('fixture listener')
    })
    const observed = vi.fn(() => currentCompletedWorkflowDocumentId())
    const unsubscribe = onWorkflowWarningsReady(observed)
    try {
      mocks.document = 'complete'
      notifyWorkflowWarningsReady()
      expect(observed).toHaveReturnedWith('complete')
    } finally {
      broken()
      unsubscribe()
    }
  })
})
