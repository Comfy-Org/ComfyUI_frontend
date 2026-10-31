import { createSharedComposable, useEventListener } from '@vueuse/core'
import { FirebaseError } from 'firebase/app'
import { sendEmailVerification } from 'firebase/auth'
import { computed, ref } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useAuthStore } from '@/stores/authStore'

const PASSWORD_PROVIDER_ID = 'password'
const RESEND_COOLDOWN_MS = 60_000
const DISMISSED_AT_KEY = 'Comfy.EmailVerificationNudge.DismissedAt'

const SESSION_START_MS = Date.now()

function readDismissedAt(): number {
  try {
    const raw = localStorage.getItem(DISMISSED_AT_KEY)
    const parsed = raw === null ? NaN : Number(raw)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

function useEmailVerificationInternal() {
  const authStore = useAuthStore()
  const currentUser = computed(() => authStore.currentUser)
  const { flags } = useFeatureFlags()
  const toast = useToast()

  const userReloadedTick = ref(0)
  const canResend = ref(true)
  const dismissedAt = ref(readDismissedAt())

  const isPasswordUser = computed(() => {
    void userReloadedTick.value
    return (
      currentUser.value?.providerData.some(
        (provider) => provider.providerId === PASSWORD_PROVIDER_ID
      ) ?? false
    )
  })

  const needsEmailVerification = computed(() => {
    void userReloadedTick.value
    const user = currentUser.value
    if (!user) return false
    if (user.emailVerified) return false
    return isPasswordUser.value
  })

  const isDismissedThisSession = computed(
    () => dismissedAt.value >= SESSION_START_MS
  )

  const isNudgeEnabled = computed(
    () => isCloud && flags.emailVerificationNudgeEnabled
  )

  const isNudgeVisible = computed(
    () =>
      isNudgeEnabled.value &&
      needsEmailVerification.value &&
      !isDismissedThisSession.value
  )

  function dismiss(): void {
    const now = Date.now()
    dismissedAt.value = now
    try {
      localStorage.setItem(DISMISSED_AT_KEY, String(now))
    } catch {
      return
    }
  }

  let isRefreshing = false

  async function refresh(): Promise<void> {
    const user = currentUser.value
    if (!user || isRefreshing) return

    isRefreshing = true
    try {
      await user.reload()
      userReloadedTick.value++

      if (user.emailVerified) {
        await user.getIdToken(true)
      }
    } catch (error) {
      reportError(error, {
        errorType: 'error_refreshing_email_verification',
        surface: 'auth'
      })
    } finally {
      isRefreshing = false
    }
  }

  async function resend(): Promise<void> {
    const user = currentUser.value
    if (!user || !canResend.value) return

    canResend.value = false
    const cooldownTimeout = window.setTimeout(() => {
      canResend.value = true
    }, RESEND_COOLDOWN_MS)

    try {
      await sendEmailVerification(user, { url: window.location.origin })
    } catch (error) {
      const isRateLimited =
        error instanceof FirebaseError &&
        error.code === 'auth/too-many-requests'
      if (!isRateLimited) {
        window.clearTimeout(cooldownTimeout)
        canResend.value = true
      }
      toast.error(t('auth.emailVerification.resendFailed'), {
        description: isRateLimited
          ? t('auth.emailVerification.cooldownMessage')
          : t('auth.emailVerification.resendFailedDetail'),
        duration: 5000
      })
      return
    }

    toast.success(t('auth.emailVerification.resentSuccess'), {
      description: t('auth.emailVerification.resentSuccessDetail'),
      duration: 5000
    })
  }

  useEventListener(window, 'focus', () => {
    if (isNudgeEnabled.value && needsEmailVerification.value) void refresh()
  })

  return {
    needsEmailVerification,
    isNudgeVisible,
    canResend,
    resend,
    refresh,
    dismiss
  }
}

/** Non-blocking email-verification nudge state for password-provider users. */
export const useEmailVerification = createSharedComposable(
  useEmailVerificationInternal
)
