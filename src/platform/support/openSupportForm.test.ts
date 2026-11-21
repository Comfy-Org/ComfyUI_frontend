import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { provideCurrentUser } from '@/platform/auth/currentUserAccess'
import { openSupportForm } from '@/platform/support/openSupportForm'

describe('openSupportForm', () => {
  it("opens the form in a new tab pre-filled with the signed-in user's details", () => {
    provideCurrentUser(() => ({
      userEmail: computed(() => 'a@example.com'),
      resolvedUserInfo: computed(() => ({ id: 'user-1' })),
      isApiKeyLogin: computed(() => false),
      isLoggedIn: computed(() => true)
    }))
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    openSupportForm('bug')

    expect(openSpy).toHaveBeenCalledExactlyOnceWith(
      'https://comfysupport.portal.usepylon.com/forms/report-a-bug?email=a%40example.com&comfy_cloud_user_id=user-1',
      '_blank',
      'noopener,noreferrer'
    )
  })
})
