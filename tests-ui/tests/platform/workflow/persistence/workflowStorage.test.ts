import { describe, expect, it, beforeEach } from 'vitest'

import { clearWorkflowPersistenceStorage } from '@/platform/workflow/persistence/workflowStorage'

describe('workflowStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('clears all workflow persistence keys from storage', () => {
    localStorage.setItem('workflow', 'data')
    localStorage.setItem('Comfy.PreviousWorkflow', 'prev')
    localStorage.setItem('Comfy.OpenWorkflowsPaths', '[]')
    localStorage.setItem('Comfy.ActiveWorkflowIndex', '1')
    localStorage.setItem('unrelated', 'keep')

    sessionStorage.setItem('workflow:client-1', 'session-data')
    sessionStorage.setItem('Comfy.PreviousWorkflow:client-1', 'prev')
    sessionStorage.setItem('Comfy.ActiveWorkflowIndex:client-1', '0')
    sessionStorage.setItem('Comfy.OpenWorkflowsPaths:client-1', '[]')
    sessionStorage.setItem('custom', 'keep')

    clearWorkflowPersistenceStorage()

    expect(localStorage.getItem('workflow')).toBeNull()
    expect(localStorage.getItem('Comfy.PreviousWorkflow')).toBeNull()
    expect(localStorage.getItem('Comfy.OpenWorkflowsPaths')).toBeNull()
    expect(localStorage.getItem('Comfy.ActiveWorkflowIndex')).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep')

    expect(sessionStorage.getItem('workflow:client-1')).toBeNull()
    expect(sessionStorage.getItem('Comfy.PreviousWorkflow:client-1')).toBeNull()
    expect(
      sessionStorage.getItem('Comfy.ActiveWorkflowIndex:client-1')
    ).toBeNull()
    expect(
      sessionStorage.getItem('Comfy.OpenWorkflowsPaths:client-1')
    ).toBeNull()
    expect(sessionStorage.getItem('custom')).toBe('keep')
  })
})
