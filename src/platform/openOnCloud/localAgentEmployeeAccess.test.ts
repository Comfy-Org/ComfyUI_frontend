import type { User } from 'firebase/auth'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'

import { getCurrentAuthUser } from '@/platform/auth/authStoreAccess'
import {
  desktopHostUser,
  isDesktopHostSessionActive
} from '@/platform/auth/desktopHost/desktopHostSession'
import { webSessionUser } from '@/platform/auth/session/webSessionUser'

import { hasLocalAgentEmployeeAccess } from './localAgentEmployeeAccess'

vi.mock(import('@/platform/auth/authStoreAccess'), () => ({
  getCurrentAuthUser: vi.fn(() => null)
}))

vi.mock(import('@/platform/auth/desktopHost/desktopHostSession'), async () => {
  const { computed } = await import('vue')
  return {
    desktopHostUser: computed(() => null),
    isDesktopHostSessionActive: vi.fn(() => false)
  }
})

afterEach(() => {
  webSessionUser.value = undefined
  vi.mocked(getCurrentAuthUser).mockReturnValue(null)
  vi.mocked(isDesktopHostSessionActive).mockReturnValue(false)
})

describe('local-agent employee access', () => {
  it.for([
    { email: 'staff@comfy.org', emailVerified: true, expected: true },
    { email: 'Staff@Comfy.org', emailVerified: true, expected: true },
    { email: 'staff@comfy.org', emailVerified: false, expected: false },
    { email: 'staff@notcomfy.org', emailVerified: true, expected: false },
    {
      email: 'staff@comfy.org.example.com',
      emailVerified: true,
      expected: false
    }
  ])(
    'requires a verified employee: $email verified=$emailVerified',
    ({ email, emailVerified, expected }) => {
      vi.mocked(getCurrentAuthUser).mockReturnValue(
        fromPartial<User>({ email, emailVerified })
      )

      expect(hasLocalAgentEmployeeAccess()).toBe(expected)
    }
  )

  it('reacts to Firebase sign-in, account changes and sign-out', () => {
    const user = shallowRef<User | null>(null)
    vi.mocked(getCurrentAuthUser).mockImplementation(() => user.value)
    const enabled = computed(hasLocalAgentEmployeeAccess)
    expect(enabled.value).toBe(false)

    user.value = fromPartial<User>({
      email: 'staff@comfy.org',
      emailVerified: true
    })
    expect(enabled.value).toBe(true)

    user.value = fromPartial<User>({
      email: 'user@example.com',
      emailVerified: true
    })
    expect(enabled.value).toBe(false)

    user.value = null
    expect(enabled.value).toBe(false)
  })

  it('uses the active web session instead of a stale Firebase identity', () => {
    vi.mocked(getCurrentAuthUser).mockReturnValue(
      fromPartial<User>({ email: 'staff@comfy.org', emailVerified: true })
    )
    const enabled = computed(hasLocalAgentEmployeeAccess)

    webSessionUser.value = {
      id: 'employee',
      email: 'staff@comfy.org',
      emailVerified: true
    }
    expect(enabled.value).toBe(true)

    webSessionUser.value = {
      id: 'customer',
      email: 'user@example.com',
      emailVerified: true
    }
    expect(enabled.value).toBe(false)
  })

  it.for([
    { email: 'staff@comfy.org', expected: true },
    { email: 'user@example.com', expected: false },
    { email: undefined, expected: false }
  ])(
    'uses the signed-in desktop host account: $email',
    ({ email, expected }) => {
      vi.mocked(isDesktopHostSessionActive).mockReturnValue(true)
      vi.spyOn(desktopHostUser, 'value', 'get').mockReturnValue({
        id: 'host-user',
        email
      })

      expect(hasLocalAgentEmployeeAccess()).toBe(expected)
    }
  )

  it('does not use stale Firebase employee identity after desktop sign-out', () => {
    vi.mocked(isDesktopHostSessionActive).mockReturnValue(true)
    vi.mocked(getCurrentAuthUser).mockReturnValue(
      fromPartial<User>({ email: 'staff@comfy.org', emailVerified: true })
    )

    expect(hasLocalAgentEmployeeAccess()).toBe(false)
  })
})
