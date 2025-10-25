import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import TopMenuSection from '@/components/TopMenuSection.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import { isElectron } from '@/utils/envUtil'

const mockData = vi.hoisted(() => ({ isLoggedIn: false }))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => {
    return {
      isLoggedIn: computed(() => mockData.isLoggedIn)
    }
  }
}))

vi.mock('@/utils/envUtil')
vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({
    currentUser: null,
    loading: false
  }))
}))

function createWrapper() {
  return mount(TopMenuSection, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: {
        SubgraphBreadcrumb: true,
        CurrentUserButton: true,
        LoginButton: true
      }
    }
  })
}

describe('TopMenuSection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('authentication state', () => {
    describe('when user is logged in', () => {
      beforeEach(() => {
        mockData.isLoggedIn = true
      })

      it('should display CurrentUserButton and not display LoginButton', () => {
        const wrapper = createWrapper()
        expect(wrapper.findComponent(CurrentUserButton).exists()).toBe(true)
        expect(wrapper.findComponent(LoginButton).exists()).toBe(false)
      })
    })

    describe('when user is not logged in', () => {
      beforeEach(() => {
        mockData.isLoggedIn = false
      })

      describe('on desktop platform', () => {
        it('should display LoginButton and not display CurrentUserButton', () => {
          vi.mocked(isElectron).mockReturnValue(true)
          const wrapper = createWrapper()
          expect(wrapper.findComponent(LoginButton).exists()).toBe(true)
          expect(wrapper.findComponent(CurrentUserButton).exists()).toBe(false)
        })
      })

      describe('on web platform', () => {
        it('should not display CurrentUserButton and not display LoginButton', () => {
          const wrapper = createWrapper()
          expect(wrapper.findComponent(CurrentUserButton).exists()).toBe(false)
          expect(wrapper.findComponent(LoginButton).exists()).toBe(false)
        })
      })
    })
  })
})
