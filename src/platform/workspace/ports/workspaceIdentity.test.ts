import { describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { provideCurrentUser } from '@/platform/auth/currentUserAccess'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useWorkspaceIdentity } from './workspaceIdentity'

describe('useWorkspaceIdentity initSettled', () => {
  function signIn(userEmail: string | null, isApiKeyLogin = false) {
    provideCurrentUser(() => ({
      userEmail: computed(() => userEmail),
      isApiKeyLogin: computed(() => isApiKeyLogin)
    }))
  }

  it.for([
    { initState: 'ready', user: 'a@b.c', settled: true },
    { initState: 'error', user: 'a@b.c', settled: true },
    { initState: 'loading', user: null, settled: false },
    { initState: 'uninitialized', user: 'a@b.c', settled: false },
    { initState: 'uninitialized', user: null, settled: true }
  ] as const)(
    '$initState with user $user settles: $settled',
    ({ initState, user, settled }) => {
      signIn(user)
      Object.assign(useTeamWorkspaceStore(), { initState })

      expect(useWorkspaceIdentity().initSettled).toBe(settled)
    }
  )

  it('keeps an API-key session unsettled before init starts', () => {
    signIn(null, true)

    expect(useWorkspaceIdentity().initSettled).toBe(false)
  })
})
