import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import UserCheckView from './UserCheckView.vue'

vi.mock<unknown>(import('vue-router'), () => ({
  useRouter: () => ({ replace: vi.fn() })
}))

vi.mock<unknown>(import('@/composables/useErrorHandling'), () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync:
      <T extends (...args: never[]) => unknown>(fn: T) =>
      (...args: Parameters<T>) =>
        fn(...args)
  })
}))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/cloud/onboarding/auth'), () => ({
  getUserCloudStatus: () => new Promise(() => {}),
  getSurveyCompletedStatus: () => new Promise(() => {})
}))

describe('UserCheckView', () => {
  it('renders bootstrap state without unresolved component warnings', () => {
    vi.mocked(useFeatureFlags().flags).onboardingSurveyEnabled = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(UserCheckView, {
      global: {
        plugins: [
          createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
        ]
      }
    })

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(warn.mock.calls.flat().join(' ')).not.toContain(
      'Failed to resolve component: CloudWaitlistViewSkeleton'
    )
  })
})
