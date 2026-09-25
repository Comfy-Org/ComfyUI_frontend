<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { ModelCapability } from '../../../lib/workshop/cinematic-studio/model-capabilities'
import { videoDurationGuidance } from '../../../lib/workshop/cinematic-studio/model-capabilities'
import { modelGuidanceCopy } from '../../../lib/workshop/cinematic-studio/model-guidance-copy'
const { capabilities, locale } = defineProps<{
  capabilities: readonly ModelCapability[]
  locale: Locale
}>()
const guidanceCopy = computed(() => modelGuidanceCopy(locale))
const guidance = computed(() => videoDurationGuidance(capabilities, locale))
</script>

<template>
  <div class="mt-3 space-y-1 text-sm text-primary-warm-white">
    <p>
      <span class="text-primary-warm-gray">{{ guidanceCopy.clipLength }}:</span>
      {{ guidance.supported }}
    </p>
    <p v-if="guidance.suggestion" class="text-primary-comfy-yellow">
      {{ guidance.suggestion }}
    </p>
    <p v-if="guidance.suggestion" class="text-xs text-primary-warm-gray">
      {{ guidanceCopy.suggestionNote }}
    </p>
  </div>
</template>
