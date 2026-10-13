<script setup lang="ts">
import { computed } from 'vue'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import { brc } from '@/lib/workshop/background-removal/copy'
import EditorPromptBox from '@/components/workshop/app-editor/EditorPromptBox.vue'
import BackgroundRemovalReference from './BackgroundRemovalReference.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { setup } = cutout
const prompt = computed({
  get: () => setup.value.replace.prompt,
  set: (value: string) => cutout.updateReplace({ prompt: value }, 'prompt')
})
</script>

<template>
  <EditorPromptBox
    v-model="prompt"
    :label="brc('cutout.replace.prompt', locale)"
    :placeholder="brc('cutout.replace.placeholder', locale)"
  >
    <BackgroundRemovalReference
      :url="setup.replace.referenceUrl"
      :label="brc('cutout.replace.reference', locale)"
      :remove-label="brc('cutout.replace.reference.remove', locale)"
      @pick="cutout.setReference"
    />
    <span
      class="rounded-full bg-transparency-white-t8 px-2 py-0.5 font-mono text-[11px] text-primary-warm-gray tabular-nums"
      :title="brc('cutout.replace.count', locale, { n: setup.replace.count })"
    >
      {{
        brc('cutout.replace.count.short', locale, { n: setup.replace.count })
      }}
    </span>
  </EditorPromptBox>
</template>
