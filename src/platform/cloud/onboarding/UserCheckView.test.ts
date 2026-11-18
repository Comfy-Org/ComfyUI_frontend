import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import type { User } from 'firebase/auth'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  getSurveyCompletedStatus,
  getUserCloudStatus
} from '@/platform/cloud/onboarding/auth'
import { hasPendingDesktopLoginCode } from '@/platform/cloud/onboarding/desktopLoginRedemption'
import { useAuthStore } from '@/stores/authStore'

import UserCheckView from './UserCheckView.vue'

vi.mock(import('vue-router'))
vi.mock(import('firebase/auth'))
vi.mock(import('@/composables/useErrorHandling'))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/cloud/onboarding/auth'), () => ({
  getUserCloudStatus: vi.fn(() => new Promise<never>(() => {})),
  getSurveyCompletedStatus: vi.fn(() => new Promise<never>(() => {}))
}))
vi.mock(import('@/platform/cloud/onboarding/desktopLoginRedemption'), () => ({
  hasPendingDesktopLoginCode: vi.fn(() => false)
}))

function renderView() {
  return render(UserCheckView, {
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
      ]
    }
  })
}

describe('UserCheckView', () => {
  it('renders bootstrap state without unresolved component warnings', () => {
    vi.mocked(useFeatureFlags().flags).onboardingSurveyEnabled = true

    renderView()

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).not.toContain(
      'Failed to resolve component: CloudWaitlistViewSkeleton'
    )
  })

  it.for([true, false])(
    'routes a pending desktop sign-in to its approval page instead of the workspace (survey enabled: %s)',
    async (surveyEnabled) => {
      vi.mocked(useFeatureFlags().flags).onboardingSurveyEnabled = surveyEnabled
      useAuthStore().currentUser = fromPartial<User>({ uid: 'user-a' })
      vi.mocked(getUserCloudStatus).mockResolvedValue(fromPartial({}))
      vi.mocked(getSurveyCompletedStatus).mockResolvedValue(true)
      vi.mocked(hasPendingDesktopLoginCode).mockReturnValue(true)
      const location = { href: '' }
      vi.stubGlobal('location', location)

      renderView()

      await vi.waitFor(() =>
        expect(useRouter().replace).toHaveBeenCalledWith({
          name: 'cloud-desktop-login'
        })
      )
      expect(location.href).toBe('')
    }
  )
})
