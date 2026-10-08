<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import InfoTooltip from '@/components/ui/tooltip/InfoTooltip.vue'
import CinematicGenerateAction from '@/components/workshop/cinematic-studio/CinematicGenerateAction.vue'
import ReshootDisclosure from '@/components/workshop/cinematic-studio/reshoot/ReshootDisclosure.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import OpenjutsuMediaSlot from './OpenjutsuMediaSlot.vue'

const {
  videoUrl,
  videoName,
  clipSeconds,
  partSeconds,
  characterUrl,
  characterName,
  missing,
  gate,
  canGenerate,
  rendering,
  priceNote,
  workspaceName,
  locale = 'en'
} = defineProps<{
  videoUrl?: string
  videoName?: string
  clipSeconds?: number
  partSeconds?: number
  characterUrl?: string
  characterName?: string
  /** The first thing still needed before a run, if any. */
  missing?: 'video' | 'character' | 'target'
  gate: StudioGate
  canGenerate: boolean
  rendering: boolean
  priceNote?: string
  workspaceName?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  video: [file: File]
  character: [file: File]
  trim: []
  generate: []
}>()

const target = defineModel<string>('target', { required: true })
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

const videoDetail = computed(() =>
  clipSeconds === undefined || partSeconds === undefined
    ? undefined
    : t('openjutsu.video.detail', {
        seconds: clipSeconds.toFixed(1),
        used: partSeconds.toFixed(1)
      })
)
const NEEDS = {
  video: 'openjutsu.needs.video',
  character: 'openjutsu.needs.character',
  target: 'openjutsu.needs.target'
} as const
const footnote = computed(() => {
  if (rendering) return t('openjutsu.generate.busy')
  return missing ? t(NEEDS[missing]) : t('openjutsu.generate.note')
})
</script>

<template>
  <aside
    :aria-label="t('openjutsu.panel')"
    class="flex min-w-0 flex-col rounded-2xl bg-primary-comfy-ink-light lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)]"
    data-testid="openjutsu-side"
  >
    <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <OpenjutsuMediaSlot
        kind="video"
        :src="videoUrl"
        :name="videoName"
        :detail="videoDetail"
        :heading="t('openjutsu.video.heading')"
        :drop="t('openjutsu.video.drop')"
        :hint="t('openjutsu.video.hint')"
        :change="t('reshoot.clip.change')"
        :edit="t('openjutsu.trim.edit')"
        @pick="emit('video', $event)"
        @edit="emit('trim')"
      />
      <OpenjutsuMediaSlot
        kind="image"
        :src="characterUrl"
        :name="characterName"
        :detail="t('openjutsu.character.detail')"
        :heading="t('openjutsu.character.heading')"
        :drop="t('openjutsu.character.drop')"
        :hint="t('openjutsu.character.hint')"
        :change="t('reshoot.clip.change')"
        @pick="emit('character', $event)"
      />
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-1.5">
          <label
            for="openjutsu-target"
            class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ t('openjutsu.target.heading') }}
          </label>
          <InfoTooltip
            :text="t('openjutsu.target.help')"
            :label="t('openjutsu.target.help')"
          />
        </div>
        <input
          id="openjutsu-target"
          v-model.trim="target"
          type="text"
          maxlength="160"
          autocomplete="off"
          :placeholder="t('openjutsu.target.placeholder')"
          aria-describedby="openjutsu-target-hint"
          class="h-11 rounded-xl bg-transparency-white-t4 px-3.5 text-sm text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
        />
        <p
          id="openjutsu-target-hint"
          class="text-xs/relaxed text-primary-warm-gray"
        >
          {{ t('openjutsu.target.hint') }}
        </p>
      </div>
      <ReshootDisclosure :label="t('reshoot.advanced.label')">
        <div class="flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-1.5">
            <label
              for="openjutsu-seed"
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
            id="openjutsu-seed"
            v-model.lazy="seedText"
            type="number"
            min="0"
            step="1"
            :placeholder="t('reshoot.seed.random')"
            class="h-9 w-32 rounded-xl bg-transparency-white-t4 px-3 font-mono text-sm text-primary-warm-white tabular-nums outline-none placeholder:font-sans placeholder:text-primary-warm-gray focus-visible:ring-1 focus-visible:ring-primary-comfy-yellow/60"
          />
        </div>
      </ReshootDisclosure>
    </div>

    <footer
      class="flex flex-col gap-3 rounded-b-2xl border-t border-transparency-white-t8 p-4"
    >
      <p
        class="text-center text-xs text-primary-warm-gray"
        data-testid="openjutsu-footnote"
      >
        {{ footnote }}
      </p>
      <p
        v-if="priceNote"
        class="text-center text-xs text-primary-comfy-canvas"
        data-testid="openjutsu-price"
      >
        {{ priceNote }}
      </p>
      <Button
        v-if="gate === 'ready'"
        size="lg"
        class="rounded-full"
        :disabled="!canGenerate"
        data-testid="openjutsu-action"
        @click="emit('generate')"
      >
        {{ t('reshoot.generate.label') }}
      </Button>
      <CinematicGenerateAction
        v-else
        :gate
        :workspace-name
        :rendering="false"
        :can-generate="false"
        wide
        :locale
      />
    </footer>
  </aside>
</template>
