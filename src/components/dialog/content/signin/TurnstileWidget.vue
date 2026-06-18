<template>
  <div class="flex flex-col gap-2">
    <div ref="containerRef"></div>
    <small v-if="errorMessage" class="text-danger">{{ errorMessage }}</small>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { loadTurnstile } from '@/composables/auth/turnstileScript'
import { getTurnstileSiteKey } from '@/config/turnstile'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const token = defineModel<string>('token', { default: '' })

const { t } = useI18n()
const colorPaletteStore = useColorPaletteStore()

const containerRef = ref<HTMLDivElement>()
const errorMessage = ref('')
let widgetId: string | undefined

const clearToken = () => {
  token.value = ''
}

/**
 * Fetch a fresh challenge and clear the current token.
 *
 * Turnstile tokens are single-use, so after a token is consumed by a submit
 * attempt that did not succeed, the spent token must be discarded and a new
 * challenge requested. Clearing the model re-blocks submission until the user
 * solves the fresh challenge.
 */
const reset = () => {
  clearToken()
  if (widgetId && window.turnstile) {
    window.turnstile.reset(widgetId)
  }
}

defineExpose({ reset })

onMounted(async () => {
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
        errorMessage.value = ''
        token.value = newToken
      },
      'expired-callback': () => {
        clearToken()
        errorMessage.value = t('auth.turnstile.expired')
      },
      'error-callback': () => {
        clearToken()
        errorMessage.value = t('auth.turnstile.failed')
      }
    })
  } catch {
    errorMessage.value = t('auth.turnstile.failed')
  }
})

onBeforeUnmount(() => {
  if (widgetId && window.turnstile) {
    window.turnstile.remove(widgetId)
  }
})
</script>
