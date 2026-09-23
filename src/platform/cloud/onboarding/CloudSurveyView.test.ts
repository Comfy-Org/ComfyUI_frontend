import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAuthStore } from '@/stores/authStore'

import CloudSurveyView from './CloudSurveyView.vue'

const mocks = vi.hoisted(() => ({
  getSurveyCompletedStatus: vi.fn(),
  isSurveyReplayRequested: vi.fn(),
  reportError: vi.fn(),
  restoreSurveyReplayRequest: vi.fn(),
  submitSurvey: vi.fn(),
  trackSurvey: vi.fn()
}))

vi.mock(import('@/platform/cloud/onboarding/auth'), () => ({
  getSurveyCompletedStatus: mocks.getSurveyCompletedStatus,
  submitSurvey: mocks.submitSurvey
}))

vi.mock(import('@/platform/onboarding/onboardingReplay'), () => ({
  isSurveyReplayRequested: mocks.isSurveyReplayRequested,
  restoreSurveyReplayRequest: mocks.restoreSurveyReplayRequest
}))

vi.mock(import('@/platform/auth/firebaseIdentity'), { spy: true })

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))

vi.mock(import('@/composables/useFeatureFlags'))

const SurveyFormStub = defineComponent({
  props: { isSubmitting: Boolean },
  emits: ['submit'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          disabled: props.isSubmitting,
          onClick: () => emit('submit', { role: 'artist' })
        },
        'Submit survey'
      )
  }
})

async function renderView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'survey', component: { template: '<div />' } },
      {
        path: '/user-check',
        name: 'cloud-user-check',
        component: { template: '<div />' }
      }
    ]
  })
  await router.push('/')
  await router.isReady()
  const result = render(CloudSurveyView, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        }),
        router
      ],
      stubs: { DynamicSurveyForm: SurveyFormStub }
    }
  })
  return { router, ...result }
}

describe('CloudSurveyView', () => {
  beforeEach(() => {
    vi.mocked(firebaseIdentity.onUserChanged).mockReturnValue(() => undefined)
    vi.mocked(firebaseIdentity.onTokenChanged).mockReturnValue(() => undefined)
    Object.assign(useAuthStore(), { userId: 'account-a' })
    mocks.getSurveyCompletedStatus.mockResolvedValue(false)
    mocks.isSurveyReplayRequested.mockReturnValue(false)
    mocks.submitSurvey.mockResolvedValue({ status: 'stored' })
    vi.mocked(useFeatureFlags).mockReturnValue(
      fromPartial({ flags: { onboardingSurveyEnabled: true } })
    )
    vi.mocked(useTelemetry).mockReturnValue(
      fromPartial({ trackSurvey: mocks.trackSurvey })
    )
    vi.spyOn(useToastStore(), 'add').mockImplementation(() => undefined)
  })

  it('tracks and advances after storing a first survey', async () => {
    const { router } = await renderView()
    await waitFor(() =>
      expect(mocks.getSurveyCompletedStatus).toHaveBeenCalledOnce()
    )

    await userEvent.click(screen.getByRole('button', { name: 'Submit survey' }))

    expect(mocks.trackSurvey).toHaveBeenCalledWith('submitted', {
      role: 'artist'
    })
    expect(router.currentRoute.value.name).toBe('cloud-user-check')
  })

  it('advances without conversion telemetry after a replayed survey', async () => {
    mocks.isSurveyReplayRequested.mockReturnValue(true)
    mocks.submitSurvey.mockResolvedValue({ status: 'preserved' })
    const { router } = await renderView()
    await waitFor(() =>
      expect(mocks.getSurveyCompletedStatus).toHaveBeenCalledOnce()
    )

    await userEvent.click(screen.getByRole('button', { name: 'Submit survey' }))

    expect(mocks.trackSurvey).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('cloud-user-check')
  })

  it('stays usable and reports an unsuccessful submission', async () => {
    const error = new Error('write failed')
    mocks.submitSurvey.mockResolvedValue({ status: 'failed', cause: error })
    const { router } = await renderView()
    await waitFor(() =>
      expect(mocks.getSurveyCompletedStatus).toHaveBeenCalledOnce()
    )

    await userEvent.click(screen.getByRole('button', { name: 'Submit survey' }))

    expect(router.currentRoute.value.name).toBe('survey')
    expect(mocks.reportError).toHaveBeenCalledWith(error, {
      errorType: 'error_submitting_onboarding_survey'
    })
    expect(useToastStore().add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(screen.getByRole('button', { name: 'Submit survey' })).toBeEnabled()
  })

  it('restores a consumed replay when navigation fails', async () => {
    const error = new Error('navigation failed')
    mocks.isSurveyReplayRequested.mockReturnValue(true)
    mocks.submitSurvey.mockResolvedValue({ status: 'preserved' })
    const { router } = await renderView()
    vi.spyOn(router, 'push').mockRejectedValue(error)
    await waitFor(() =>
      expect(mocks.getSurveyCompletedStatus).toHaveBeenCalledOnce()
    )

    await userEvent.click(screen.getByRole('button', { name: 'Submit survey' }))

    expect(mocks.restoreSurveyReplayRequest).toHaveBeenCalledOnce()
    expect(mocks.reportError).toHaveBeenCalledWith(error, {
      errorType: 'error_navigating_from_onboarding_survey'
    })
    expect(useToastStore().add).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: 'Survey saved, but onboarding could not continue',
        detail: 'Please try again.'
      })
    )
    expect(screen.getByRole('button', { name: 'Submit survey' })).toBeEnabled()
  })

  it('restores a consumed replay when navigation is aborted', async () => {
    mocks.isSurveyReplayRequested.mockReturnValue(true)
    mocks.submitSurvey.mockResolvedValue({ status: 'preserved' })
    const { router } = await renderView()
    router.beforeEach(() => false)
    await waitFor(() =>
      expect(mocks.getSurveyCompletedStatus).toHaveBeenCalledOnce()
    )

    await userEvent.click(screen.getByRole('button', { name: 'Submit survey' }))

    expect(router.currentRoute.value.name).toBe('survey')
    expect(mocks.restoreSurveyReplayRequest).toHaveBeenCalledOnce()
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ type: expect.any(Number) }),
      { errorType: 'error_navigating_from_onboarding_survey' }
    )
    expect(screen.getByRole('button', { name: 'Submit survey' })).toBeEnabled()
  })
})
