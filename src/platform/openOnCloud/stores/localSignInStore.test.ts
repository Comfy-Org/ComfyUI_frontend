import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useLocalSignInStore } from '@/platform/openOnCloud/stores/localSignInStore'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/composables/auth/useAuthDialogs'))

describe('useLocalSignInStore', () => {
  it.for([true, false])(
    'is signed in when the sign-in dialog finishes: %s',
    async (finished) => {
      vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValueOnce(
        finished
      )
      const store = useLocalSignInStore()

      await store.signIn()

      expect(store.signedIn).toBe(finished)
    }
  )

  it('a sign-in from the prototype panel closes the sign-in dialog', async () => {
    const dialogStore = useDialogStore()
    dialogStore.showDialog({ key: 'global-signin', component: {} })

    useLocalSignInStore().signedIn = true
    await nextTick()

    expect(dialogStore.isDialogOpen('global-signin')).toBe(false)
  })
})
