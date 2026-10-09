<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import RunLeaveDialog from '@/components/workshop/RunLeaveDialog.vue'
import AppEditorShell from '@/components/workshop/app-editor/AppEditorShell.vue'
import type { EditorView } from '@/components/workshop/app-editor/view'
import VideoTrimDialog from '@/components/workshop/video-trim/VideoTrimDialog.vue'
import { useCinematicLeaveGuard } from '@/composables/useCinematicLeaveGuard'
import { useOpenjutsu } from '@/composables/useOpenjutsu'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { workshopAppRepo } from '@/lib/workshop/apps'
import { SWAP_TRIM_LIMITS } from '@/lib/workshop/openjutsu/clip'
import OpenjutsuPanel from './OpenjutsuPanel.vue'
import OpenjutsuResultDock from './OpenjutsuResultDock.vue'
import OpenjutsuRun from './OpenjutsuRun.vue'
import OpenjutsuStage from './OpenjutsuStage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const swap = useOpenjutsu({ locale })
const {
  sample,
  video,
  videoUrl,
  clipSeconds,
  character,
  characterUrl,
  target,
  seed,
  size,
  savedSize,
  range,
  partSeconds,
  takes,
  selected,
  current,
  rendering,
  gate,
  missing,
  canGenerate,
  priceNote,
  session,
  trimming,
  trimOpen,
  trimInitial
} = swap

const { leavingTo, leave, stay } = useCinematicLeaveGuard(
  () => rendering.value,
  () => swap.cancel()
)

const view = ref<EditorView>('result')
watch(selected, () => (view.value = 'result'))

const finished = computed(() =>
  current.value?.status === 'done' ? current.value : undefined
)
const download = computed(() =>
  finished.value?.url
    ? {
        href: finished.value.url,
        name: `openjutsu-take-${finished.value.n}.mp4`
      }
    : undefined
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
    :title="t('openjutsu.title')"
    :tools-label="t('openjutsu.tools')"
    :repo="workshopAppRepo('openjutsu')"
    :panel-labels="{
      label: t('openjutsu.panel'),
      expand: t('openjutsu.sheet.expand'),
      collapse: t('openjutsu.sheet.collapse')
    }"
    :show-dock="!!finished"
    :download
    :locale
    data-testid="openjutsu"
  >
    <OpenjutsuStage
      :video-url="videoUrl"
      :range
      :part-seconds="partSeconds"
      :frame="savedSize"
      :takes
      :selected
      :current
      :rendering
      :sample
      :view
      :locale
      @select="selected = $event"
      @video="swap.takeVideo"
      @cancel="swap.cancel"
      @reuse="swap.reuse"
    />

    <template #tray>
      <p
        v-if="sample && !finished"
        class="pointer-events-auto max-w-120 rounded-full border border-transparency-white-t8 bg-primary-comfy-ink-light/90 px-3 py-1.5 text-center text-[11px] text-primary-warm-gray"
        data-testid="openjutsu-sample-banner"
      >
        {{ t('openjutsu.sample.banner') }}
      </p>
    </template>
    <template #dock>
      <OpenjutsuResultDock
        v-if="finished"
        v-model:view="view"
        :locale
        @reuse="swap.reuse(finished.id)"
      />
    </template>

    <template v-if="videoUrl" #panel>
      <OpenjutsuPanel
        v-model:target="target"
        v-model:seed="seed"
        v-model:size="size"
        :video-url="videoUrl"
        :video-name="video?.name"
        :clip-seconds="clipSeconds"
        :range
        :part-seconds="partSeconds"
        :character-url="characterUrl"
        :character-name="character?.name"
        :locale
        @video="swap.takeVideo"
        @character="swap.takeCharacter"
        @trim="swap.editTrim"
      />
    </template>
    <template v-if="videoUrl" #panel-peek>
      <span class="flex shrink-0 items-center gap-1">
        <video
          :src="videoUrl"
          muted
          playsinline
          preload="metadata"
          aria-hidden="true"
          class="h-7 w-10 rounded-sm bg-primary-comfy-ink object-cover"
        />
        <img
          v-if="characterUrl"
          :src="characterUrl"
          alt=""
          class="size-7 rounded-sm object-cover"
        />
      </span>
      <span class="min-w-0 flex-1 truncate text-xs text-primary-warm-white">
        <template v-if="partSeconds !== undefined">
          {{ t('openjutsu.peek.seconds', { seconds: partSeconds.toFixed(1) }) }}
          ·
        </template>
        {{ target || t('openjutsu.needs.target') }}
      </span>
      <span class="shrink-0 text-xs text-primary-warm-gray">{{ size }}</span>
    </template>
    <template v-if="videoUrl" #panel-footer>
      <OpenjutsuRun
        :gate
        :missing
        :can-generate="canGenerate"
        :rendering
        :price-note="priceNote"
        :workspace-name="session?.workspace.name"
        :locale
        @generate="swap.generate"
        @cancel="swap.cancel"
      />
    </template>
  </AppEditorShell>
  <VideoTrimDialog
    v-model:open="trimOpen"
    :file="trimming"
    :limits="SWAP_TRIM_LIMITS"
    :initial="trimInitial"
    :locale
    @confirm="swap.confirmTrim"
  />
  <RunLeaveDialog
    :open="leavingTo !== undefined"
    :locale
    @update:open="(value: boolean) => !value && stay()"
    @leave="leave"
  />
</template>
