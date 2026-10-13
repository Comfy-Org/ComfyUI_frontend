<script setup lang="ts">
import { useId } from 'vue'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import { brc } from '@/lib/workshop/background-removal/copy'
import BackgroundRemovalReference from './BackgroundRemovalReference.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { setup } = cutout
const promptId = useId()

function onPrompt(event: Event) {
  if (event.target instanceof HTMLTextAreaElement)
    cutout.updateReplace({ prompt: event.target.value }, 'prompt')
}
</script>

<template>
  <section class="flex flex-col">
    <label :for="promptId" class="sr-only">
      {{ brc('cutout.replace.prompt', locale) }}
    </label>
    <div
      class="flex flex-col overflow-hidden rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
    >
      <textarea
        :id="promptId"
        :value="setup.replace.prompt"
        rows="4"
        :placeholder="brc('cutout.replace.placeholder', locale)"
        class="h-28 resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray disabled:opacity-40"
        @input="onPrompt"
      />
      <div class="flex items-center justify-between gap-2 pr-3 pb-2.5 pl-2.5">
        <BackgroundRemovalReference
          :url="setup.replace.referenceUrl"
          :label="brc('cutout.replace.reference', locale)"
          :remove-label="brc('cutout.replace.reference.remove', locale)"
          @pick="cutout.setReference"
        />
        <span
          class="rounded-full bg-transparency-white-t8 px-2 py-0.5 font-mono text-[11px] text-primary-warm-gray tabular-nums"
          :title="
            brc('cutout.replace.count', locale, { n: setup.replace.count })
          "
        >
          {{
            brc('cutout.replace.count.short', locale, {
              n: setup.replace.count
            })
          }}
        </span>
      </div>
    </div>
  </section>
</template>
