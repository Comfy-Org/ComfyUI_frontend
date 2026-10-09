<script setup lang="ts">
import { Cpu } from '@lucide/vue'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import { REPLACE_MODELS } from '@/lib/workshop/background-removal/contract'
import { brc } from '@/lib/workshop/background-removal/copy'
import EditorOutput from '@/components/workshop/app-editor/EditorOutput.vue'
import BackgroundRemovalPrompt from './BackgroundRemovalPrompt.vue'
import { modelName } from './model-name'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { setup } = cutout
const models = REPLACE_MODELS.map(({ id }) => ({
  id,
  label: modelName(id, locale)
}))
</script>

<template>
  <EditorOutput
    :model-value="setup.replace.model"
    :heading="brc('cutout.replace.model', locale)"
    :options="models"
    :icon="Cpu"
    @update:model-value="(model) => cutout.updateReplace({ model })"
  />
  <BackgroundRemovalPrompt :cutout :locale class="px-1" />
</template>
