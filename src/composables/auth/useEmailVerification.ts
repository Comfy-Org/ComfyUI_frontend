import { createSharedComposable, useEventListener } from '@vueuse/core'
import { FirebaseError } from 'firebase/app'
import { sendEmailVerification } from 'firebase/auth'
import { computed, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAuthStore } from '@/stores/authStore'

const PASSWORD_PROVIDER_ID = 'password'
const RESEND_COOLDOWN_MS = 60_000
const DISMISSED_AT_KEY = 'Comfy.EmailVerificationNudge.DismissedAt'

/**
 * Timestamp captured once when the module loads (app start). A dismissal that
 * happened before this point belongs to an earlier session, so the nudge is
 * re-prompted at most once per session while the dismissal itself persists.
 */
const SESSION_START_MS = Date.now()

type EmailVerificationNudgeVariant = 'credits' | 'generic'

function readDismissedAt(): number {
  const raw = localStorage.getItem(DISMISSED_AT_KEY)
  const parsed = raw === null ? NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Non-blocking, client-side email-verification nudge. Exposes whether an
 * authenticated password-provider user still needs to verify their email, a
 * resend action with a client-side cooldown, and a refresh that lazily
 * propagates a verified state to the backend via a forced token refresh.
 *
 * Nothing here gates a route, dialog, or feature — it only drives an optional
 * banner.
 */
function useEmailVerificationInternal() {
  const authStore = useAuthStore()
  const currentUser = computed(() => authStore.currentUser)
  const { flags } = useFeatureFlags()
  const { subscriptionStatus } = useSubscription()
  const toastStore = useToastStore()

  // Bumped after an in-place `User.reload()` so computeds that read the mutated
  // firebase user object (whose reference does not change) re-evaluate.
  const reloadTick = ref(0)
  const canResend = ref(true)
  const dismissedAt = ref(readDismissedAt())

  const isPasswordUser = computed(() => {
    void reloadTick.value
    return (
      currentUser.value?.providerData.some(
        (provider) => provider.providerId === PASSWORD_PROVIDER_ID
      ) ?? false
    )
  })

  const needsEmailVerification = computed(() => {
    void reloadTick.value
    const user = currentUser.value
    if (!user) return false
    if (user.emailVerified !== false) return false
    return isPasswordUser.value
  })

  const freeTierVerificationRequired = computed(
    () =>
      subscriptionStatus.value?.free_tier_grant_state ===
      'verification_required'
  )

  const isDismissedThisSession = computed(
    () => dismissedAt.value >= SESSION_START_MS
  )

  const nudgeVariant = computed<EmailVerificationNudgeVariant | null>(() => {
    if (!isCloud || !flags.emailVerificationNudgeEnabled) return null
    if (!needsEmailVerification.value) return null
    // The credit-specific state is more important than a prior dismissal, so it
    // stays visible until verification clears it.
    if (freeTierVerificationRequired.value) return 'credits'
    if (isDismissedThisSession.value) return null
    return 'generic'
  })

  function dismiss(): void {
    const now = Date.now()
    dismissedAt.value = now
    localStorage.setItem(DISMISSED_AT_KEY, String(now))
  }

  async function refresh(): Promise<void> {
    const user = currentUser.value
    if (!user || user.emailVerified) return

    try {
      await user.reload()
      reloadTick.value++

      if (user.emailVerified) {
        // Force a token refresh so subsequent API calls carry the
        // `email_verified=true` claim, letting the backend lazily persist it.
        await user.getIdToken(true)
      }
    } catch (error) {
      console.error('Failed to refresh email verification status:', error)
    }
  }

  async function resend(): Promise<void> {
    const user = currentUser.value
    if (!user || !canResend.value) return

    canResend.value = false
    window.setTimeout(() => {
      canResend.value = true
    }, RESEND_COOLDOWN_MS)

    try {
      await sendEmailVerification(user, { url: window.location.origin })
    } catch (error) {
      const isRateLimited =
        error instanceof FirebaseError &&
        error.code === 'auth/too-many-requests'
      toastStore.add({
        severity: 'error',
        summary: t('auth.emailVerification.resendFailed'),
        detail: isRateLimited
          ? t('auth.emailVerification.cooldownMessage')
          : t('auth.emailVerification.resendFailedDetail'),
        life: 5000
      })
      return
    }

    toastStore.add({
      severity: 'success',
      summary: t('auth.emailVerification.resentSuccess'),
      detail: t('auth.emailVerification.resentSuccessDetail'),
      life: 5000
    })
    await refresh()
  }

  useEventListener(window, 'focus', () => {
    if (nudgeVariant.value) void refresh()
  })

  return {
    needsEmailVerification,
    nudgeVariant,
    canResend,
    resend,
    refresh,
    dismiss
  }
}

export const useEmailVerification = createSharedComposable(
  useEmailVerificationInternal
)
