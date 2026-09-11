<template>
  <SharedTurnstileWidget
    ref="widget"
    v-model:token="token"
    v-model:unavailable="unavailable"
    :site-key="getTurnstileSiteKey()"
    :theme="theme"
    :expired-message="t('auth.turnstile.expired')"
    :failed-message="t('auth.turnstile.failed')"
    error-class="text-red-500"
    :loader="loadTurnstile"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { TurnstileWidget as SharedTurnstileWidget } from '@comfyorg/account/vue'
import { loadTurnstile } from '@comfyorg/account/turnstileScript'

import { getTurnstileSiteKey } from '@/config/turnstile'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const token = defineModel<string>('token', { default: '' })
const unavailable = defineModel<boolean>('unavailable', { default: false })

const { t } = useI18n()
const colorPaletteStore = useColorPaletteStore()
// The palette setting can settle after this dialog mounts; the shared widget
// reads `theme` once its loader resolves, so a computed keeps that timing.
const theme = computed(() =>
  colorPaletteStore.completedActivePalette.light_theme ? 'light' : 'dark'
)

const widget = ref<InstanceType<typeof SharedTurnstileWidget>>()

defineExpose({ reset: () => widget.value?.reset() })
</script>
