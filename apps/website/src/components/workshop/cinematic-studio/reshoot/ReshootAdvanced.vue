<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed } from 'vue'

import InfoTooltip from '@/components/ui/tooltip/InfoTooltip.vue'
import type { Locale } from '@/i18n/translations'
import ReshootDisclosure from './ReshootDisclosure.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const prompt = defineModel<string>('prompt', { required: true })
const seed = defineModel<number | undefined>('seed')
/** Empty is random; a number, whole and not negative, is a fixed seed. */
const seedText = computed({
  get: () => (seed.value === undefined ? '' : String(seed.value)),
  // a number field's v-model already hands over a number, or '' when empty
  set: (entry: string | number) => {
    const value = typeof entry === 'number' ? entry : Number.parseFloat(entry)
    seed.value = Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : undefined
  }
})
</script>

<template>
  <ReshootDisclosure :label="t('reshoot.advanced.label')">
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <label
            for="reshoot-prompt"
            class="text-xs font-semibold text-primary-comfy-canvas"
          >
            {{ t('reshoot.section.prompt') }}
            <span class="font-normal text-primary-warm-gray">
              · {{ t('reshoot.optional') }}
            </span>
          </label>
          <InfoTooltip
            :text="t('reshoot.promptHelp')"
            :label="t('reshoot.promptHelp')"
          />
        </div>
        <textarea
          id="reshoot-prompt"
          v-model="prompt"
          rows="2"
          :placeholder="t('reshoot.prompt.placeholder')"
          aria-describedby="reshoot-prompt-dialogue"
          class="field-sizing-content max-h-40 min-h-16 resize-none rounded-xl bg-transparency-white-t4 px-3.5 py-2.5 text-sm/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
        />
        <p
          id="reshoot-prompt-dialogue"
          class="text-xs/relaxed text-primary-warm-gray"
        >
          {{ t('reshoot.prompt.dialogue') }}
        </p>
      </div>
      <div class="flex items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-1.5">
          <label
            for="reshoot-seed"
            class="font-semibold text-primary-comfy-canvas"
          >
            {{ t('reshoot.seed.label') }}
          </label>
          <InfoTooltip
            :text="t('reshoot.seed.help')"
            :label="t('reshoot.seed.help')"
          />
        </div>
        <input
          id="reshoot-seed"
          v-model.lazy="seedText"
          type="number"
          min="0"
          step="1"
          :placeholder="t('reshoot.seed.random')"
          class="h-9 w-28 rounded-xl bg-transparency-white-t4 px-3 font-mono text-sm text-primary-warm-white tabular-nums outline-none placeholder:font-sans placeholder:text-primary-warm-gray focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
        />
      </div>
    </div>
  </ReshootDisclosure>
</template>
