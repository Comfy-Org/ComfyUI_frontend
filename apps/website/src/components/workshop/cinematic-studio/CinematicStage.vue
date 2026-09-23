<script setup lang="ts">
import { Download } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  CinematicModel
} from '../../../lib/workshop/cinematic-studio/catalog'
import { failureLabelKey } from '../../../lib/workshop/failure-label'
import type { Reel, Take } from '../../../lib/workshop/cinematic-studio/reel'
import {
  selectedTake,
  takesOfShot
} from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

const {
  reel,
  models,
  locale = 'en'
} = defineProps<{
  reel: Reel
  models: readonly CinematicModel[]
  locale?: Locale
}>()

const emit = defineEmits<{ select: [id: string] }>()

const current = computed(() => selectedTake(reel))
const siblings = computed(() =>
  current.value ? takesOfShot(reel, current.value.shot) : []
)
const modelName = (slug: string) =>
  models.find((model) => model.slug === slug)?.name ?? slug

const ratio = (aspect: AspectRatio) => aspect.replace(':', ' / ')

const statusText = (take: Take) => {
  if (take.status === 'rendering') return t('cinematic.stage.rendering', locale)
  if (take.status === 'failed') return t(failureLabelKey[take.reason], locale)
  if (take.status === 'cancelled') return t('workshop.output.cancelled', locale)
  return ''
}
</script>

<template>
  <main
    class="flex min-w-0 flex-1 flex-col bg-primary-comfy-ink"
    :aria-label="t('cinematic.stage.label', locale)"
  >
    <div
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-10 pt-10"
    >
      <template v-if="current">
        <figure
          class="relative flex max-h-[70vh] w-full max-w-5xl items-center justify-center overflow-hidden rounded-md bg-transparency-white-t4"
          :style="{ aspectRatio: ratio(current.aspect) }"
        >
          <img
            v-if="current.status === 'done'"
            :src="current.output.url"
            :alt="current.prompt"
            class="size-full object-contain"
          />
          <figcaption
            v-else
            role="status"
            class="flex flex-col items-center gap-3 text-sm text-primary-comfy-canvas"
          >
            {{ statusText(current) }}
            <span
              v-if="current.status === 'rendering'"
              class="h-0.5 w-48 overflow-hidden rounded-full bg-transparency-white-t8"
              aria-hidden="true"
            >
              <span
                class="block h-full w-1/3 animate-pulse rounded-full bg-primary-warm-white"
              />
            </span>
          </figcaption>
        </figure>

        <div class="flex w-full max-w-5xl items-center gap-2.5">
          <span class="text-[15px] font-semibold text-primary-warm-white">
            {{
              t('cinematic.stage.shot', locale).replace(
                '{number}',
                String(current.shot)
              )
            }}
          </span>
          <div
            v-if="siblings.length > 1"
            role="tablist"
            :aria-label="t('cinematic.stage.takes', locale)"
            class="flex gap-1"
          >
            <button
              v-for="take in siblings"
              :key="take.id"
              type="button"
              role="tab"
              :aria-selected="take.id === current.id"
              :class="
                cn(
                  'grid size-6 place-items-center rounded-md text-xs font-medium',
                  take.id === current.id
                    ? 'bg-primary-warm-white text-primary-comfy-ink'
                    : 'text-primary-warm-gray hover:bg-transparency-white-t8'
                )
              "
              @click="emit('select', take.id)"
            >
              {{ take.letter }}
            </button>
          </div>
          <span class="truncate text-sm text-primary-warm-gray">
            {{ modelName(current.modelSlug) }} · {{ current.aspect }}
          </span>
          <span class="flex-1" />
          <a
            v-if="current.status === 'done'"
            :href="current.output.url"
            :download="current.output.fileName"
            class="grid size-9 place-items-center rounded-lg text-primary-comfy-canvas hover:bg-transparency-white-t8"
            :aria-label="t('cinematic.stage.download', locale)"
          >
            <Download class="size-4" aria-hidden="true" />
          </a>
        </div>
      </template>

      <div v-else class="flex flex-col items-center gap-2 text-center">
        <p class="text-base font-semibold text-primary-warm-white">
          {{ t('cinematic.stage.emptyTitle', locale) }}
        </p>
        <p class="text-sm text-primary-warm-gray">
          {{ t('cinematic.stage.emptyBody', locale) }}
        </p>
      </div>
    </div>

    <nav
      v-if="reel.takes.length"
      :aria-label="t('cinematic.stage.sequence', locale)"
      class="flex h-24 shrink-0 items-center justify-center gap-3 overflow-x-auto px-10"
    >
      <button
        v-for="(take, index) in reel.takes"
        :key="take.id"
        type="button"
        :aria-current="take.id === current?.id"
        :aria-label="
          t('cinematic.stage.thumb', locale)
            .replace('{shot}', String(take.shot))
            .replace('{take}', take.letter)
        "
        :class="
          cn(
            'h-14 shrink-0 overflow-hidden rounded-sm bg-transparency-white-t8 transition-opacity',
            index > 0 && reel.takes[index - 1].shot !== take.shot && 'ml-3',
            take.id === current?.id
              ? 'opacity-100 outline-2 outline-offset-2 outline-primary-warm-white'
              : 'opacity-50 hover:opacity-100'
          )
        "
        :style="{ aspectRatio: ratio(take.aspect) }"
        @click="emit('select', take.id)"
      >
        <img
          v-if="take.status === 'done'"
          :src="take.output.url"
          alt=""
          class="size-full object-cover"
        />
      </button>
    </nav>
  </main>
</template>
