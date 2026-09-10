<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { ModelLaunchAudioCard } from './types'

import AudioPlayer from '../../components/common/AudioPlayer.vue'
import CopyTextButton from '../../components/ui/copy-text-button/CopyTextButton.vue'
import { t } from '../../i18n/translations'

const { locale = 'en', card } = defineProps<{
  card: ModelLaunchAudioCard
  locale?: Locale
}>()
</script>

<template>
  <article>
    <AudioPlayer
      :locale
      :sources="card.audioSources"
      :poster="card.posterSrc"
      :aria-label="card.description[locale] || card.description.en"
      class="rounded-4.5xl aspect-19/10 border-0"
    />

    <p class="mt-6 text-base font-semibold text-primary-comfy-canvas">
      {{ card.description[locale] || card.description.en }}
    </p>

    <div
      class="mt-4 flex items-end gap-2 rounded-3xl border border-primary-warm-gray p-6"
    >
      <p
        class="line-clamp-5 flex-1 text-sm/relaxed font-light whitespace-pre-line text-primary-warm-gray"
      >
        {{ card.prompt[locale] || card.prompt.en }}
      </p>
      <CopyTextButton
        class="-mr-2 -mb-2"
        :value="card.prompt[locale] || card.prompt.en"
        :label="t('modelLaunch.copyPrompt', locale)"
        :copied-label="t('ui.copied', locale)"
      />
    </div>
  </article>
</template>
