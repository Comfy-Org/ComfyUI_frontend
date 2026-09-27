<template>
  <div class="flex flex-col gap-2">
    <div ref="containerRef"></div>
    <small
      v-if="errorMessage"
      role="alert"
      aria-live="assertive"
      class="text-red-500"
      >{{ errorMessage }}</small
    >
  </div>
</template>

<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { loadTurnstile } from '@/composables/auth/turnstileScript'
import { getTurnstileSiteKey } from '@/config/turnstile'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const token = defineModel<string>('token', { default: '' })
/**
 * Set true whenever the widget cannot be relied on to ever produce a token:
 * the Cloudflare script failed to load, the rendered challenge errored out,
 * or it simply hasn't resolved within `TURNSTILE_LOAD_TIMEOUT_MS`. The parent
 * uses this to stop waiting on a token so a broken/slow widget (network
 * issue, ad-blocker, CDN outage) can never permanently block signup.
 */
const unavailable = defineModel<boolean>('unavailable', { default: false })

const { t } = useI18n()
const colorPaletteStore = useColorPaletteStore()

const containerRef = ref<HTMLDivElement>()
const errorMessage = ref('')
let widgetId: string | undefined

/** How long to wait for the widget to resolve before falling back. */
const TURNSTILE_LOAD_TIMEOUT_MS = 9_000
const { start: armTimeout, stop: clearLoadTimeout } = useTimeoutFn(
  () => {
    unavailable.value = true
  },
  TURNSTILE_LOAD_TIMEOUT_MS,
  { immediate: false }
)

const clearToken = () => {
  token.value = ''
}

/**
 * Fetch a fresh challenge and clear the current token.
 *
 * Turnstile tokens are single-use, so after a token is consumed by a submit
 * attempt that did not succeed, the spent token must be discarded and a new
 * challenge requested. Clearing the model re-blocks submission until the user
 * solves the fresh challenge; clearing the error drops any stale failure text
 * so it can't linger over the new challenge.
 */
const reset = () => {
  clearToken()
  errorMessage.value = ''
  if (widgetId && window.turnstile) {
    window.turnstile.reset(widgetId)
    // A widget that renders can request a fresh challenge, so give it
    // another chance before falling back again.
    unavailable.value = false
    armTimeout()
  }
}

defineExpose({ reset })

onMounted(async () => {
  armTimeout()

  try {
    const turnstile = await loadTurnstile()
    if (!containerRef.value) return

    const theme = colorPaletteStore.completedActivePalette.light_theme
      ? 'light'
      : 'dark'

    widgetId = turnstile.render(containerRef.value, {
      sitekey: getTurnstileSiteKey(),
      theme,
      callback: (newToken: string) => {
        clearLoadTimeout()
        errorMessage.value = ''
        unavailable.value = false
        token.value = newToken
      },
      'expired-callback': () => {
        clearToken()
        errorMessage.value = t('auth.turnstile.expired')
        if (widgetId && window.turnstile) {
          window.turnstile.reset(widgetId)
          // A solved token can expire on its own (e.g. the tab was
          // backgrounded past the token's ~300s lifetime) without the widget
          // ever erroring, so proactively request a fresh challenge and
          // re-arm the load timeout in case it doesn't resolve in time.
          armTimeout()
        }
      },
      'error-callback': () => {
        clearToken()
        clearLoadTimeout()
        console.warn('Turnstile challenge failed')
        errorMessage.value = t('auth.turnstile.failed')
        unavailable.value = true
        if (widgetId && window.turnstile) window.turnstile.reset(widgetId)
      }
    })
  } catch (error) {
    clearLoadTimeout()
    console.warn('Turnstile failed to load', error)
    errorMessage.value = t('auth.turnstile.failed')
    unavailable.value = true
  }
})

onBeforeUnmount(() => {
  if (widgetId && window.turnstile) {
    window.turnstile.remove(widgetId)
  }
})
</script>
