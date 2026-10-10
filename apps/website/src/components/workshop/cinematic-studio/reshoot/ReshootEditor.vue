<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AppEditorShell from '@/components/workshop/app-editor/AppEditorShell.vue'
import type { useReshoot } from '@/composables/useReshoot'
import { workshopAppRepo } from '@/lib/workshop/apps'
import type { Locale } from '@/i18n/translations'
import type { ReshootSound, ReshootView } from './output'
import ReshootEditorDock from './ReshootEditorDock.vue'
import ReshootEditorSettings from './ReshootEditorSettings.vue'
import ReshootEditorStage from './ReshootEditorStage.vue'
import ReshootExamples from './ReshootExamples.vue'
import ReshootRun from './ReshootRun.vue'
import ReshootUpload from './ReshootUpload.vue'

/** Re-shoot on the full-screen editor: the same state, framed by the kit. */
const { reshoot, locale = 'en' } = defineProps<{
  reshoot: ReturnType<typeof useReshoot>
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const {
  upload,
  clip,
  clipName,
  isExample,
  picked,
  aspect,
  size,
  depth,
  stage,
  notice,
  frames,
  clipError,
  geometry,
  step,
  view: camera,
  pose,
  onKey,
  keepAim,
  frame,
  keys,
  motion,
  prompt,
  seed,
  takes,
  selected,
  current,
  gate,
  canGenerate,
  priceNote,
  session
} = reshoot

const view = ref<ReshootView>('result')
const sound = ref<ReshootSound>('generated')
watch(selected, () => (view.value = 'result'))

const finished = computed(() =>
  picked.value && current.value?.status === 'done' && current.value.url
    ? current.value
    : undefined
)
const download = computed(() => {
  const take = finished.value
  if (!take?.url) return undefined
  const original = sound.value === 'original'
  return {
    href: original ? (take.originalUrl ?? take.url) : take.url,
    name: `crossview-take-${take.n}${original ? '-original-audio' : ''}.mp4`
  }
})
const framesText = computed(() =>
  frames.value === undefined
    ? ''
    : t('reshoot.frames', {
        frames: frames.value,
        seconds: (frames.value / 24).toFixed(1)
      })
)

onMounted(() =>
  document.documentElement.setAttribute('data-workshop-editor', '')
)
onBeforeUnmount(() =>
  document.documentElement.removeAttribute('data-workshop-editor')
)
</script>

<template>
  <AppEditorShell
    :title="t('reshoot.title')"
    :tools-label="t('reshoot.tools')"
    :repo="workshopAppRepo('reshoot')"
    :panel-labels="{
      label: t('reshoot.panel'),
      expand: t('reshoot.sheet.expand'),
      collapse: t('reshoot.sheet.collapse')
    }"
    :show-dock="!!finished"
    :download
    :locale
    data-testid="reshoot"
  >
    <ReshootEditorStage
      v-if="picked"
      v-model:frame="frame"
      v-model:motion="motion"
      :clip
      :camera
      :depth
      :stage
      :notice="depth === 'failed' ? undefined : notice"
      :step
      :takes
      :selected
      :current
      :geometry
      :pose
      :keep-aim="keepAim"
      :keys
      :keyed="onKey"
      :view
      :sound
      :locale
      @aim="reshoot.aim"
      @select="selected = $event"
      @cancel="reshoot.cancel"
      @key="reshoot.toggleKey"
      @clear-keys="keys = []"
    />
    <div
      v-else
      class="flex max-h-full w-full max-w-md touch-pan-y flex-col gap-5 self-center overflow-y-auto overscroll-contain"
      data-testid="reshoot-empty"
    >
      <p class="text-center text-sm text-primary-warm-gray">
        {{ t('reshoot.pick.lead') }}
      </p>
      <ReshootUpload :locale @pick="reshoot.pick" />
      <ReshootExamples :locale @pick="reshoot.pick()" />
      <p class="text-center text-[11px] text-primary-warm-gray/80">
        {{ t('reshoot.credit') }}
      </p>
    </div>

    <template #dock>
      <ReshootEditorDock
        v-if="finished"
        v-model:view="view"
        v-model:sound="sound"
        :locale
        @reuse="reshoot.reuse(selected)"
      />
    </template>

    <template v-if="picked" #panel>
      <div class="flex flex-col gap-6 pt-3 pb-4 md:pt-2">
        <ReshootEditorSettings
          v-model:upload="upload"
          v-model:aspect="aspect"
          v-model:size="size"
          v-model:seed="seed"
          v-model:keep-aim="keepAim"
          v-model:frame="frame"
          v-model:prompt="prompt"
          :clip
          :clip-name="clipName"
          :is-example="isExample"
          :camera
          :keys
          :depth
          :frames
          :clip-error="clipError"
          :locale
          @aim="reshoot.aim"
          @remove-key="reshoot.removeKey"
        />
        <ReshootExamples
          :active-id="isExample ? 'crossview-example' : undefined"
          :locale
          @pick="reshoot.pick()"
        />
      </div>
    </template>
    <template v-if="picked" #panel-peek>
      <video
        :src="clip"
        muted
        playsinline
        preload="metadata"
        aria-hidden="true"
        class="h-7 w-12 shrink-0 rounded-sm bg-primary-comfy-ink object-cover"
      />
      <span class="min-w-0 flex-1 truncate text-xs text-primary-warm-white">
        {{ isExample ? t('reshoot.pick.exampleTitle') : clipName }}
      </span>
      <span v-if="framesText" class="shrink-0 text-xs text-primary-warm-gray">
        {{ framesText }}
      </span>
    </template>
    <template v-if="picked" #panel-footer>
      <ReshootRun
        :depth
        :error="depth === 'failed' ? notice : undefined"
        :gate
        :can-generate="canGenerate"
        :price-note="priceNote"
        :workspace-name="session?.workspace.name"
        quiet
        :locale
        @analyze="reshoot.analyze"
        @generate="reshoot.generate"
      />
    </template>
  </AppEditorShell>
</template>
