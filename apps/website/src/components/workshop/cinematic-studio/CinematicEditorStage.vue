<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AspectRatio } from '@/lib/workshop/cinematic-studio/catalog'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import type { Reel } from '@/lib/workshop/cinematic-studio/reel'
import { selectedTake, takesOfShot } from '@/lib/workshop/cinematic-studio/reel'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { framedStyle } from './aspect-style'
import CinematicCreditSummary from './CinematicCreditSummary.vue'
import CinematicSequence from './CinematicSequence.vue'
import CinematicTakeBar from './CinematicTakeBar.vue'
import CinematicTakeFrame from './CinematicTakeFrame.vue'

const {
  reel,
  aspect,
  models,
  memberWorkspace,
  locale = 'en'
} = defineProps<{
  reel: Reel
  aspect: AspectRatio
  models: readonly CinematicModel[]
  memberWorkspace?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  select: [id: string]
  retry: [...ids: string[]]
}>()

const current = computed(() => selectedTake(reel))
const modelName = computed(
  () =>
    models.find((model) => model.slug === current.value?.modelSlug)?.name ?? ''
)
const siblings = computed(() =>
  current.value ? takesOfShot(reel, current.value.shot) : []
)
const glass =
  'rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink-light/90 backdrop-blur-sm'
</script>

<template>
  <section
    class="flex size-full max-w-6xl min-w-0 flex-col items-center gap-3"
    :aria-label="t('cinematic.stage.label')"
  >
    <div
      v-if="current"
      :class="cn(glass, 'flex h-10 max-w-full shrink-0 items-center pr-1 pl-4')"
      data-testid="cinematic-output-header"
    >
      <CinematicTakeBar
        :current
        :siblings
        :model-name="modelName"
        :take-picker="false"
        :locale
      />
    </div>
    <div
      class="flex min-h-0 w-full flex-1 items-center justify-center"
      style="container-type: size"
      data-testid="cinematic-output-body"
    >
      <CinematicTakeFrame
        v-if="current"
        :current
        :member-workspace="memberWorkspace"
        height="100cqh"
        :locale
        @retry="emit('retry', current.id)"
      />
      <div
        v-else
        class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-transparency-white-t20 bg-primary-comfy-ink/70 p-6 text-center transition-[aspect-ratio] duration-300"
        :style="framedStyle(aspect, '100cqh')"
        data-testid="cinematic-frame-preview"
      >
        <span
          class="text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
        >
          {{ aspect }}
        </span>
        <p class="text-base font-semibold text-primary-warm-white">
          {{ t('cinematic.stage.emptyTitle') }}
        </p>
        <p class="text-sm text-primary-warm-gray">
          {{ t('cinematic.stage.emptyBody') }}
        </p>
      </div>
    </div>
    <CinematicCreditSummary
      v-if="current"
      :takes="siblings"
      :member-workspace="memberWorkspace"
      :locale
      class="w-full max-w-3xl shrink-0"
      @retry="emit('retry', ...$event)"
    />
    <CinematicSequence
      v-if="reel.takes.length"
      :takes="reel.takes"
      :current-id="current?.id"
      :locale
      :class="cn(glass, 'shrink-0 p-1.5')"
      @select="emit('select', $event)"
    />
  </section>
</template>
