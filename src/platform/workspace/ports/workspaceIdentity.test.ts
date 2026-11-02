import { describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { provideCurrentUser } from '@/platform/auth/currentUserAccess'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useWorkspaceIdentity } from './workspaceIdentity'

describe('useWorkspaceIdentity initSettled', () => {
  function signIn(loggedIn: boolean, userEmail: string | null = null) {
    provideCurrentUser(() => ({
      userEmail: computed(() => userEmail),
      isApiKeyLogin: computed(() => false),
      isLoggedIn: computed(() => loggedIn)
    }))
  }

  it.for([
    { initState: 'ready', loggedIn: true, settled: true },
    { initState: 'error', loggedIn: true, settled: true },
    { initState: 'loading', loggedIn: false, settled: false },
    { initState: 'uninitialized', loggedIn: true, settled: false },
    { initState: 'uninitialized', loggedIn: false, settled: true }
  ] as const)(
    '$initState with loggedIn $loggedIn settles: $settled',
    ({ initState, loggedIn, settled }) => {
      signIn(loggedIn)
      Object.assign(useTeamWorkspaceStore(), { initState })

      expect(useWorkspaceIdentity().initSettled).toBe(settled)
    }
  )

  it('keeps an authenticated user with no email unsettled before init starts', () => {
    signIn(true, null)
    Object.assign(useTeamWorkspaceStore(), { initState: 'uninitialized' })

    expect(useWorkspaceIdentity().initSettled).toBe(false)
  })
})
