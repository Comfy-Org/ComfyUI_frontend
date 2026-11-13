import {
  autoTopUpOffView,
  isAutoTopUpNotAvailable
} from '@comfyorg/account-core/billing'
import { autoTopUpCardView } from '@comfyorg/account-ui/billing'
import { reportError } from '@comfyorg/telemetry/reportError'
import { computedAsync } from '@vueuse/core'
import { computed, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAutoTopUpCardViewed } from '@/platform/billing/composables/useAutoTopUpCardViewed'
import { useAutoTopUpCardCopy } from '@/platform/billing/composables/useAutoTopUpCopy'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'
import { platformAutoTopUpPath } from '@/platform/billing/platformAutoTopUpPath'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'

/** The auto top-up card's served state, copy and Platform link while the card is shown. */
export function useAutoTopUpCardSection(shown: MaybeRefOrGetter<boolean>) {
  const { locale } = useI18n()
  const copy = useAutoTopUpCardCopy()
  const { autoTopUpSetup } = useBillingCapabilities()
  const { scope, state, isReady, ensureRead, retry } = useBillingAutoTopUpCard()

  watch(
    () => toValue(shown),
    (visible) => {
      if (visible) ensureRead()
    },
    { immediate: true }
  )

  useAutoTopUpCardViewed(() => {
    const current = state.value
    return toValue(shown) &&
      !isAutoTopUpNotAvailable(autoTopUpSetup.value) &&
      isReady.value &&
      current.kind === 'loaded'
      ? current.settings.status
      : undefined
  })

  const offSettings = computed(() =>
    toValue(shown) &&
    state.value.kind === 'loaded' &&
    state.value.settings.status === 'off'
      ? state.value.settings
      : null
  )

  const savedPaymentMethodsRead = computedAsync(async () => {
    const requestScope = scope.value
    if (
      !offSettings.value ||
      autoTopUpOffView({
        setup: autoTopUpSetup.value,
        savedPaymentMethodCount: null
      }) === 'off'
    ) {
      return null
    }
    const result = await useBillingSdkStore().readPaymentMethods()
    if (result.status === 'ok') {
      return { scope: requestScope, methods: result.value }
    }
    reportError(
      new Error(`Saved payment methods read failed: ${result.code}`),
      {
        errorType: 'auto_top_up_payment_methods_read_failed',
        surface: 'billing'
      }
    )
    return null
  }, null)

  const offView = computed(() => {
    const read = savedPaymentMethodsRead.value
    return autoTopUpOffView({
      setup: autoTopUpSetup.value,
      savedPaymentMethodCount:
        read?.scope === scope.value ? read.methods.length : null
    })
  })

  const action = computed(() =>
    state.value.kind === 'loaded'
      ? autoTopUpCardView(
          state.value.settings,
          offView.value,
          copy.value,
          locale.value
        ).action
      : 'turn_on'
  )

  const { href, track, available } = usePlatformHandoff(
    () => platformAutoTopUpPath(action.value),
    () => ({ target: 'auto_top_up', action: action.value })
  )

  return {
    setup: autoTopUpSetup,
    state,
    offView,
    copy,
    retry,
    href,
    track,
    available
  }
}
