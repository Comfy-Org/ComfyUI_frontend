import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  persistedWorkflows: [] as unknown[],
  newUser: undefined as boolean | undefined
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ persistedWorkflows: state.persistedWorkflows })
}))
vi.mock('@/services/useNewUserService', () => ({
  useNewUserService: () => ({ isNewUser: () => state.newUser })
}))

import { hasNoSavedWorkflows, isNewUser } from './coachmarkGates'

describe('coachmarkGates', () => {
  describe('hasNoSavedWorkflows', () => {
    it('passes when the user has no persisted workflows', () => {
      state.persistedWorkflows = []
      expect(hasNoSavedWorkflows()).toBe(true)
    })

    it('fails once the user has saved a workflow', () => {
      state.persistedWorkflows = [{ path: 'saved.json' }]
      expect(hasNoSavedWorkflows()).toBe(false)
    })
  })

  describe('isNewUser', () => {
    it('passes for a confirmed new user', () => {
      state.newUser = true
      expect(isNewUser()).toBe(true)
    })

    it('fails for a returning user', () => {
      state.newUser = false
      expect(isNewUser()).toBe(false)
    })

    it('fails when newness is still undetermined', () => {
      state.newUser = undefined
      expect(isNewUser()).toBe(false)
    })
  })
})
