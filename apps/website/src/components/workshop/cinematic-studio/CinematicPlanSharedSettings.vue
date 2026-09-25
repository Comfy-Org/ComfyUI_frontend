<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { PlanSettingsSnapshot } from '../../../lib/workshop/cinematic-studio/scene-builder'
import { tcBuilder } from '../../../lib/workshop/cinematic-studio/builder-copy'
import Button from '../../ui/button/Button.vue'
const { settings, sharedSettings, locale } = defineProps<{
  settings?: PlanSettingsSnapshot
  sharedSettings?: PlanSettingsSnapshot
  locale: Locale
}>()
const emit = defineEmits<{ capture: [] }>()
const t = (key: Parameters<typeof tcBuilder>[0]) => tcBuilder(key, locale)
</script>
<template>
  <section
    class="flex min-w-0 flex-col gap-2 rounded-xl border border-transparency-white-t8 p-3 text-sm text-primary-warm-white"
  >
    <p>{{ t('sharedSettings') }}</p>
    <p v-if="settings" class="wrap-break-word text-primary-comfy-canvas">
      {{ settings.modelName || settings.modelSlug }}
      · {{ settings.aspect }} · {{ settings.resolution }} · {{ settings.takes }}
      {{ t('takeCount') }} · {{ settings.references.length }}
      {{ t('references') }}
    </p>
    <p v-else class="text-primary-comfy-canvas">{{ t('noSettings') }}</p>
    <Button
      variant="outline"
      :disabled="!sharedSettings"
      @click="emit('capture')"
      >{{ t('captureSettings') }}</Button
    >
    <p class="text-xs text-primary-comfy-canvas">
      {{ t('settingsReview') }}
    </p>
  </section>
</template>
