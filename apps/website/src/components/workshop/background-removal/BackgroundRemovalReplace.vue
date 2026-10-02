<script setup lang="ts">
import { Cpu } from '@lucide/vue'
import { useId } from 'vue'

import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { Locale } from '../../../i18n/translations'
import { REPLACE_MODELS } from '../../../lib/workshop/background-removal/contract'
import { brc } from '../../../lib/workshop/background-removal/copy'
import EditorOutput from '../app-editor/EditorOutput.vue'
import BackgroundRemovalReference from './BackgroundRemovalReference.vue'
import { modelName } from './model-name'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { setup } = cutout
const promptId = useId()
const models = REPLACE_MODELS.map(({ id }) => ({
  id,
  label: modelName(id, locale)
}))

function onPrompt(event: Event) {
  if (event.target instanceof HTMLTextAreaElement)
    cutout.updateReplace({ prompt: event.target.value }, 'prompt')
}
</script>

<template>
  <EditorOutput
    :model-value="setup.replace.model"
    :heading="brc('cutout.replace.model', locale)"
    :options="models"
    :icon="Cpu"
    @update:model-value="(model) => cutout.updateReplace({ model })"
  />
  <div class="flex flex-col gap-1.5 px-1">
    <div
      class="flex flex-col gap-2 rounded-xl bg-transparency-white-t4 p-2 ring-1 ring-transparency-white-t8 ring-inset has-[textarea:focus-visible]:ring-primary-comfy-yellow/50"
    >
      <div class="flex items-start gap-2">
        <BackgroundRemovalReference
          :url="setup.replace.referenceUrl"
          :label="brc('cutout.replace.reference', locale)"
          :remove-label="brc('cutout.replace.reference.remove', locale)"
          @pick="cutout.setReference"
        />
        <label :for="promptId" class="sr-only">{{
          brc('cutout.replace.prompt', locale)
        }}</label>
        <textarea
          :id="promptId"
          :value="setup.replace.prompt"
          rows="3"
          :placeholder="brc('cutout.replace.placeholder', locale)"
          class="min-h-18 flex-1 resize-none bg-transparent pt-1 text-xs text-primary-warm-white placeholder:text-primary-warm-gray/70 focus-visible:outline-none disabled:opacity-40"
          @input="onPrompt"
        />
      </div>
      <div class="flex items-center justify-end">
        <span
          class="rounded-full bg-transparency-white-t8 px-2 py-0.5 font-mono text-[11px] text-primary-warm-gray tabular-nums"
          :title="
            brc('cutout.replace.count', locale, { n: setup.replace.count })
          "
          >{{
            brc('cutout.replace.count.short', locale, {
              n: setup.replace.count
            })
          }}</span
        >
      </div>
    </div>
  </div>
</template>
