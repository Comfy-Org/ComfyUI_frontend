<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import type { ModelLaunchAudioCard } from './types'

import AudioPlayer from '@/components/common/AudioPlayer.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { translationsFor } from '@/i18n/translations'

const {
  locale = 'en',
  card,
  model,
  autoplay = false
} = defineProps<{
  card: ModelLaunchAudioCard
  model?: string
  autoplay?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

function trackTitle(card: ModelLaunchAudioCard) {
  const text = card.title ?? card.description
  return text[locale] || text.en
}
</script>

<template>
  <article
    class="flex flex-col overflow-hidden rounded-4.5xl bg-primary-comfy-ink lg:col-span-3"
    :aria-label="t('modelLaunch.promptWindow')"
  >
    <header class="flex items-center gap-3 border-b border-white/10 px-5 py-3">
      <span class="flex gap-1.5" aria-hidden="true">
        <span class="size-2.5 rounded-full bg-white/15" />
        <span class="size-2.5 rounded-full bg-white/15" />
        <span class="size-2.5 rounded-full bg-white/15" />
      </span>
      <span
        class="flex-1 truncate text-xs font-extrabold tracking-wider text-primary-warm-gray uppercase"
      >
        {{ t('modelLaunch.promptWindow') }}
      </span>
      <span
        v-if="model"
        class="rounded-full bg-white/8 px-3 py-1 font-mono text-xs text-primary-comfy-yellow"
      >
        {{ model }}
      </span>
    </header>

    <dl
      v-if="card.voices?.length"
      class="flex flex-col gap-2 border-b border-white/10 px-5 py-4 text-sm"
    >
      <div
        v-for="voice in card.voices"
        :key="voice.name"
        class="flex flex-wrap items-baseline gap-x-3"
      >
        <dt
          :class="
            cn(
              'w-14 shrink-0 text-xs font-extrabold tracking-wider text-primary-warm-gray',
              !voice.alias && 'uppercase'
            )
          "
        >
          {{ voice.alias ? voice.alias : t('modelLaunch.voice') }}
        </dt>
        <dd class="font-light text-primary-warm-white">{{ voice.name }}</dd>
      </div>
    </dl>

    <div class="flex items-start gap-2 px-5 py-5">
      <!-- Rendered as text, so <whisper> and <emphasis> tags show verbatim. -->
      <p
        class="min-h-40 flex-1 font-mono text-sm/relaxed whitespace-pre-wrap text-primary-comfy-canvas"
      >
        {{ card.prompt[locale] || card.prompt.en }}
      </p>
      <CopyTextButton
        class="-mt-2 -mr-2"
        :value="card.prompt[locale] || card.prompt.en"
        :label="t('modelLaunch.copyPrompt')"
        :copied-label="t('ui.copied')"
      />
    </div>

    <AudioPlayer
      :key="card.id"
      :locale
      :sources="card.audioSources"
      :autoplay
      :aria-label="trackTitle(card)"
      class="mt-auto aspect-auto h-20 rounded-none border-0 border-t border-white/10 bg-primary-comfy-ink-light"
    />
  </article>
</template>
