import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useDowngradeToPersonal } from './useDowngradeToPersonal'

const mockMembers = vi.hoisted(() => ({
  value: [] as WorkspaceMember[]
}))
const mockUserEmail = vi.hoisted(() => ({ value: '' as string | null }))
const mockRemoveMember = vi.hoisted(() => vi.fn())
const mockSubscribe = vi.hoisted(() => vi.fn())

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    members: mockMembers,
    removeMember: mockRemoveMember
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userEmail: mockUserEmail
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    subscribe: mockSubscribe
  })
}))

function createMember(
  overrides: Partial<WorkspaceMember> = {}
): WorkspaceMember {
  return {
    id: 'member-1',
    name: 'Member One',
    email: 'member1@example.com',
    joinDate: new Date('2025-01-15'),
    role: 'member',
    ...overrides
  }
}

describe('useDowngradeToPersonal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMembers.value = []
    mockUserEmail.value = 'owner@example.com'
  })

  describe('removableMembers / hasOtherMembers', () => {
    it('excludes the owner role from removable members', () => {
      mockMembers.value = [
        createMember({
          id: 'owner',
          role: 'owner',
          email: 'owner@example.com'
        }),
        createMember({ id: 'm1', email: 'm1@example.com' })
      ]
      const { removableMembers, hasOtherMembers } = useDowngradeToPersonal()
      expect(removableMembers.value.map((m) => m.id)).toEqual(['m1'])
      expect(hasOtherMembers.value).toBe(true)
    })

    it('excludes the current user even if listed as a plain member', () => {
      mockUserEmail.value = 'me@example.com'
      mockMembers.value = [
        createMember({ id: 'me', role: 'member', email: 'me@example.com' }),
        createMember({ id: 'm1', email: 'm1@example.com' })
      ]
      const { removableMembers } = useDowngradeToPersonal()
      expect(removableMembers.value.map((m) => m.id)).toEqual(['m1'])
    })

    it('reports no other members when only the creator is present', () => {
      mockMembers.value = [
        createMember({ id: 'owner', role: 'owner', email: 'owner@example.com' })
      ]
      const { removableMembers, hasOtherMembers } = useDowngradeToPersonal()
      expect(removableMembers.value).toEqual([])
      expect(hasOtherMembers.value).toBe(false)
    })
  })

  describe('downgradeToPersonal', () => {
    it('removes every non-creator member then initiates the tier change', async () => {
      mockMembers.value = [
        createMember({
          id: 'owner',
          role: 'owner',
          email: 'owner@example.com'
        }),
        createMember({ id: 'm1', email: 'm1@example.com' }),
        createMember({ id: 'm2', email: 'm2@example.com' })
      ]
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(mockRemoveMember).toHaveBeenCalledTimes(2)
      expect(mockRemoveMember).toHaveBeenCalledWith('m1')
      expect(mockRemoveMember).toHaveBeenCalledWith('m2')
      expect(mockRemoveMember).not.toHaveBeenCalledWith('owner')
      expect(mockSubscribe).toHaveBeenCalledWith('founder-monthly')
    })

    it('never removes the creator', async () => {
      mockUserEmail.value = 'me@example.com'
      mockMembers.value = [
        createMember({ id: 'me', role: 'owner', email: 'me@example.com' })
      ]
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(mockRemoveMember).not.toHaveBeenCalled()
      expect(mockSubscribe).toHaveBeenCalledWith('founder-monthly')
    })

    it('removes members before changing the tier', async () => {
      mockMembers.value = [
        createMember({
          id: 'owner',
          role: 'owner',
          email: 'owner@example.com'
        }),
        createMember({ id: 'm1', email: 'm1@example.com' })
      ]
      const calls: string[] = []
      mockRemoveMember.mockImplementation(() => {
        calls.push('remove')
        return Promise.resolve()
      })
      mockSubscribe.mockImplementation(() => {
        calls.push('subscribe')
        return Promise.resolve()
      })
      const { downgradeToPersonal } = useDowngradeToPersonal()

      await downgradeToPersonal('founder-monthly')

      expect(calls).toEqual(['remove', 'subscribe'])
    })
  })
})
