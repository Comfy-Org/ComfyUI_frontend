<script setup lang="ts">
import { ArrowUpRight, ImagePlus, Loader2, Play, RefreshCw } from '@lucide/vue'

import { computed } from 'vue'

import HeroNodeWidgets from './HeroNodeWidgets.vue'
import { NODE_TITLE_KEYS } from './heroWorkflowGraph'
import type { HeroWorkflowRun } from './useHeroWorkflowRun'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { run, locale = 'en' } = defineProps<{
  run: HeroWorkflowRun
  locale?: Locale
}>()

const filenameWidget = [
  { name: 'filename_prefix', value: 'Krea2_turbo', kind: 'text' as const }
]

const percent = computed(() => Math.round(run.totalProgress.value * 100))

const statusLabel = computed(() =>
  run.activeNode.value
    ? t(NODE_TITLE_KEYS[run.activeNode.value], locale)
    : t('hero.node.output', locale)
)
</script>

<template>
  <HeroNodeWidgets :widgets="filenameWidget" />

  <div
    class="bg-hero-node-inset relative mt-1 aspect-square overflow-hidden rounded-lg"
  >
    <Transition name="hero-render">
      <img
        v-if="run.outputSrc.value"
        :key="run.outputSrc.value"
        :src="run.outputSrc.value"
        :alt="t('hero.output.alt', locale)"
        draggable="false"
        class="absolute inset-0 size-full object-cover select-none"
      />
    </Transition>

    <div
      v-if="run.phase.value === 'idle'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <span
        class="flex size-11 items-center justify-center rounded-full bg-white/5"
      >
        <ImagePlus class="size-5 text-white/40" />
      </span>
      <p class="max-w-52 text-sm text-white/50">
        {{ t('hero.output.hint', locale) }}
      </p>
      <button
        type="button"
        class="bg-hero-exec flex cursor-pointer items-center gap-2 rounded-lg px-7 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
        @click="run.run()"
      >
        <Play class="size-4 fill-current" />
        {{ t('hero.run', locale) }}
      </button>
    </div>

    <div
      v-else-if="run.phase.value === 'running'"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60"
    >
      <Loader2 class="text-hero-exec size-6 animate-spin" />
      <p class="flex items-baseline gap-2 text-sm text-white/75">
        <span>{{ statusLabel }}</span>
        <span class="font-semibold text-white tabular-nums">
          {{ percent }}%
        </span>
      </p>
    </div>
  </div>

  <template v-if="run.phase.value === 'done'">
    <div class="mt-2 flex items-center justify-between gap-2">
      <span class="truncate font-mono text-[11px] text-white/40 tabular-nums">
        {{ t('hero.output.seed', locale) }} {{ run.seed.value }}
      </span>
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/15"
        @click="run.run()"
      >
        <RefreshCw class="size-3" />
        {{ t('hero.runAgain', locale) }}
      </button>
    </div>
    <a
      :href="externalLinks.cloud"
      target="_blank"
      class="bg-primary-comfy-yellow mt-2 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold tracking-wide text-primary-comfy-ink uppercase transition-opacity hover:opacity-90"
    >
      {{ t('hero.output.openCloud', locale) }}
      <ArrowUpRight class="size-3.5" />
    </a>
  </template>
</template>
