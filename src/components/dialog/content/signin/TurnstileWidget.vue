<template>
  <SharedTurnstileWidget
    ref="widget"
    v-model:token="token"
    v-model:unavailable="unavailable"
    :site-key="getTurnstileSiteKey()"
    :theme="theme"
    :expired-message="t('auth.turnstile.expired')"
    :failed-message="t('auth.turnstile.failed')"
    :loader="loadTurnstile"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import SharedTurnstileWidget from '@comfyorg/auth-core/TurnstileWidget.vue'

import { loadTurnstile } from '@/composables/auth/turnstileScript'
import { getTurnstileSiteKey } from '@/config/turnstile'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const token = defineModel<string>('token', { default: '' })
const unavailable = defineModel<boolean>('unavailable', { default: false })

const { t } = useI18n()
const colorPaletteStore = useColorPaletteStore()
const theme = colorPaletteStore.completedActivePalette.light_theme
  ? 'light'
  : 'dark'

const widget = ref<InstanceType<typeof SharedTurnstileWidget>>()

defineExpose({ reset: () => widget.value?.reset() })
</script>
