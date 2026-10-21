<script setup lang="ts">
import { vfxMediaRoot, vfxVariantMedia } from '@/data/vfxMedia'
import { computed, onMounted, ref, useId, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import BrandButton from '@/components/common/BrandButton.vue'
import GlassCard from '@/components/common/GlassCard.vue'
import VideoCompareSlider from '@/components/common/VideoCompareSlider.vue'
import VideoPlayer from '@/components/common/VideoPlayer.vue'
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import { externalLinks } from '@/config/routes'
import { campaignHref } from '@/utils/campaignHref'
import { prefersReducedMotion } from '@/composables/useReducedMotion'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  demo,
  source,
  mediaKind,
  variants,
  locale = 'en',
  workflowHref
} = defineProps<{
  demo: 'relight' | 'swap' | 'reframe' | 'sequence'
  source: string
  mediaKind: 'video' | 'image'
  variants: { id: string; label: string }[]
  locale?: Locale
  workflowHref?: string
}>()
const { t } = translationsFor(locale)
const root = useTemplateRef<HTMLElement>('root')
const signupHref = ref<string>(externalLinks.cloudSignup)
const studioTitleId = `vfx-${demo}-${useId()}-title`
const signupHintId = `vfx-${demo}-${useId()}-signup`
const mode = ref('workflow')
const time = ref(0)
const paused = ref(prefersReducedMotion())
const selected = ref(variants[0].id)
const description = ref(t(`vfxV3.studio.${demo}.description`))
const look = ref('')
const active = computed(
  () => variants.find((variant) => variant.id === selected.value) ?? variants[0]
)
const steps = computed(() => [
  t(`vfxV3.studio.${demo}.stepOne`),
  t(`vfxV3.studio.${demo}.stepTwo`)
])
const request = computed(() =>
  t('vfxV3.studio.requestText', {
    task: t(`vfxV3.demos.${demo}.title`),
    look: look.value || active.value.label,
    description: description.value
  })
)
const inputClass =
  'w-full rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 px-4 py-3 text-sm text-primary-warm-white outline-none focus-visible:border-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-50'

useEventListener(
  root,
  'timeupdate',
  (event: Event) => {
    if (demo === 'sequence' && event.target instanceof HTMLVideoElement)
      time.value = event.target.currentTime
  },
  { capture: true }
)

function playbackPaused(requested?: boolean) {
  const view = root.value?.closest<HTMLElement>('.vfx-studio-view')
  if (view?.hidden || view?.inert) return true
  if (requested !== undefined) return requested
  const owner = root.value?.closest<HTMLElement>('vfx-workflow-showcase')
  return owner?.dataset.playbackPaused === undefined
    ? prefersReducedMotion()
    : owner.dataset.playbackPaused === 'true'
}

function selectVariant(id: string) {
  selected.value = id
  paused.value = playbackPaused()
  const showcase = root.value?.closest<HTMLElement>('vfx-workflow-showcase')
  if (!showcase) return
  showcase.dataset.selectedVariant = id
  showcase.dispatchEvent(
    new CustomEvent('workflow-variant-change', { detail: id })
  )
}

onMounted(() => {
  signupHref.value = campaignHref(
    externalLinks.cloudSignup,
    window.location.href
  )
  paused.value = playbackPaused()
  const id = root.value?.closest<HTMLElement>('vfx-workflow-showcase')?.dataset
    .selectedVariant
  if (id && variants.some((variant) => variant.id === id)) selected.value = id
})
useEventListener(
  () => root.value?.closest('vfx-workflow-showcase'),
  'workflow-variant-change',
  (event: Event) => {
    if (
      event instanceof CustomEvent &&
      typeof event.detail === 'string' &&
      variants.some((variant) => variant.id === event.detail)
    )
      selected.value = event.detail
  }
)
function isFileDrag(event: DragEvent) {
  return event.dataTransfer?.types.includes('Files') ?? false
}

function onFileDragOver(event: DragEvent) {
  if (!isFileDrag(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'link'
}

function onFileDrop(event: DragEvent) {
  if (!isFileDrag(event)) return
  event.preventDefault()
  event.stopPropagation()
  window.location.assign(
    campaignHref(externalLinks.cloudSignup, window.location.href)
  )
}

function workflowDetail(event: Event): object | undefined {
  if (!(event instanceof CustomEvent)) return undefined
  const detail: unknown = event.detail
  return typeof detail === 'object' && detail !== null ? detail : undefined
}

function updateMode(value: unknown) {
  if (value === 'settings' || value === 'workflow') mode.value = value
}

function updateTime(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) time.value = value
}

useEventListener(
  () => root.value?.closest('vfx-workflow-showcase'),
  'workflow-studio-mode',
  (event: Event) => {
    const detail = workflowDetail(event)
    if (!detail) return
    updateMode('mode' in detail ? detail.mode : undefined)
    updateTime('time' in detail ? detail.time : undefined)
    paused.value = playbackPaused(
      'paused' in detail && typeof detail.paused === 'boolean'
        ? detail.paused
        : undefined
    )
  }
)
useEventListener(
  () => root.value?.closest('vfx-workflow-showcase'),
  'workflow-playback-change',
  (event: Event) => {
    const detail = workflowDetail(event)
    if (detail && 'paused' in detail && typeof detail.paused === 'boolean')
      paused.value = playbackPaused(detail.paused)
  }
)
useEventListener(
  () => root.value?.closest('vfx-workflow-showcase'),
  'workflow-time-change',
  (event: Event) => {
    const detail = workflowDetail(event)
    if (detail) updateTime('time' in detail ? detail.time : undefined)
  }
)
</script>

<template>
  <div
    ref="root"
    data-vfx-studio
    role="region"
    :aria-labelledby="studioTitleId"
    :data-playback-time="time"
    class="min-w-0 space-y-6"
    @dragover.capture="onFileDragOver"
    @drop.capture="onFileDrop"
  >
    <div>
      <h3
        :id="studioTitleId"
        class="text-2xl text-primary-warm-white md:text-3xl"
      >
        {{ t(`vfxV3.studio.${demo}.title`) }}
      </h3>
      <p class="mt-3 text-sm text-primary-warm-gray">
        {{ t('vfxV3.studio.sampleOnly') }}
      </p>
    </div>
    <div class="grid min-w-0 gap-6 lg:grid-cols-2">
      <GlassCard>
        <div class="space-y-4 p-4">
          <p class="text-sm font-semibold text-primary-warm-white">
            {{ demo === 'sequence' ? active.label : t('vfxV3.studio.footage') }}
          </p>
          <VideoPlayer
            v-if="demo === 'sequence'"
            :key="active.id"
            data-vfx-sequence-player
            :src="vfxVariantMedia(active.id, 'mp4')"
            :poster="vfxVariantMedia(active.id, 'jpg')"
            :aria-label="active.label"
            :locale="locale"
            fit="contain"
            preview
            loop
            hide-controls
            class="overflow-hidden rounded-2xl"
          />
          <VideoCompareSlider
            v-else
            v-model:time="time"
            v-model:paused="paused"
            comparison-style="workflow"
            :synchronized-playback="mediaKind === 'video'"
            :media-kind="mediaKind"
            fit="contain"
            :before-src="`${vfxMediaRoot}/${source}.${mediaKind === 'video' ? 'mp4' : 'jpg'}`"
            :after-src="
              vfxVariantMedia(active.id, mediaKind === 'video' ? 'mp4' : 'jpg')
            "
            :before-poster-src="`${vfxMediaRoot}/${source}.jpg`"
            :after-poster-src="vfxVariantMedia(active.id, 'jpg')"
            :before-label="t('vfxV3.originalFootage')"
            :after-label="active.label"
            :slider-label="t('modelLaunch.beforeAfter.sliderLabel')"
            class="rounded-2xl"
          />
          <p class="text-sm text-primary-warm-gray">
            {{ t(`vfxV3.studio.${demo}.source`) }}
          </p>
          <p
            v-if="mediaKind === 'video' && demo !== 'sequence'"
            class="text-sm text-primary-warm-gray"
          >
            {{ t('vfxV3.studio.videoMetadata') }}
          </p>
          <p class="text-sm text-primary-warm-gray">
            {{ t('vfxV3.studio.sourceHint') }}
          </p>
          <p :id="signupHintId" class="text-sm text-primary-warm-gray">
            {{ t('vfxV3.studio.uploadHint') }}
          </p>
          <BrandButton
            :href="signupHref"
            :aria-describedby="signupHintId"
            variant="outline"
            class="font-bold"
          >
            {{ t('vfxV3.studio.upload') }}
          </BrandButton>
        </div>
      </GlassCard>
      <GlassCard>
        <TabsRoot v-model="mode" class="min-w-0 p-4">
          <TabsList :aria-label="t('vfxV3.studio.mode')" class="flex gap-1">
            <TabsTrigger
              v-for="tab in ['settings', 'workflow']"
              :key="tab"
              :value="tab"
              class="cursor-pointer rounded-full px-4 py-2 text-sm font-bold text-primary-comfy-canvas/65 transition-colors hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none data-[state=active]:bg-primary-comfy-yellow data-[state=active]:text-primary-comfy-ink"
            >
              {{ t(`vfxV3.studio.${tab}`) }}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="settings" class="mt-6 space-y-6">
            <fieldset class="min-w-0">
              <legend class="mb-3 text-sm text-primary-warm-white">
                {{ t(`vfxV3.studio.${demo}.presets`) }}
              </legend>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button
                  v-for="variant in variants"
                  :key="variant.id"
                  type="button"
                  :aria-pressed="selected === variant.id"
                  class="min-w-0 rounded-2xl bg-transparency-white-t4 p-2 text-left text-sm text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow aria-pressed:bg-transparency-white-t20"
                  @click="selectVariant(variant.id)"
                >
                  <img
                    :src="vfxVariantMedia(variant.id, 'jpg')"
                    alt=""
                    width="160"
                    height="90"
                    class="aspect-video w-full rounded-lg object-contain"
                  />
                  <span class="mt-2 block">{{ variant.label }}</span>
                </button>
              </div>
            </fieldset>
            <label class="block space-y-2 text-sm text-primary-warm-white">
              <span>{{ t(`vfxV3.studio.${demo}.look`) }}</span>
              <textarea
                v-model="look"
                :placeholder="active.label"
                :class="inputClass"
                rows="3"
              />
            </label>
            <label class="block space-y-2 text-sm text-primary-warm-white">
              <span>{{ t('vfxV3.studio.shot') }}</span>
              <textarea v-model="description" :class="inputClass" rows="5" />
            </label>
            <ol class="space-y-3">
              <li
                v-for="(step, index) in steps"
                :key="step"
                class="flex gap-3 rounded-2xl bg-transparency-white-t4 p-4 text-sm text-primary-warm-white"
              >
                <span class="font-semibold text-primary-comfy-yellow">{{
                  index + 1
                }}</span>
                <span>{{ step }}</span>
              </li>
            </ol>
            <div class="flex flex-wrap gap-3">
              <BrandButton v-if="demo !== 'sequence'" disabled>
                {{ t('vfxV3.studio.adjust') }}
              </BrandButton>
              <BrandButton disabled variant="outline">
                {{ t('vfxV3.studio.generate') }}
              </BrandButton>
            </div>
          </TabsContent>
          <TabsContent value="workflow" class="mt-6 space-y-6">
            <BrandButton
              :href="workflowHref"
              :disabled="!workflowHref"
              target="_blank"
              variant="outline"
            >
              {{ t('vfxV3.studio.expose') }} ↗
            </BrandButton>
            <div class="space-y-4">
              <h4 class="text-lg text-primary-warm-white">
                {{ t('vfxV3.studio.request') }}
              </h4>
              <p class="text-sm text-primary-warm-gray">
                {{ t('vfxV3.studio.requestHelp') }}
              </p>
              <blockquote
                class="text-sm wrap-break-word whitespace-pre-wrap text-primary-warm-white"
              >
                {{ request }}
              </blockquote>
              <div
                class="flex items-center gap-2 text-sm text-primary-warm-white"
              >
                <CopyTextButton
                  :value="request"
                  :label="t('vfxV3.studio.copy')"
                  :copied-label="t('vfxV3.studio.copied')"
                />
                <span>{{ t('vfxV3.studio.copy') }}</span>
              </div>

              <BrandButton disabled variant="outline"
                >{{ t('vfxV3.studio.openAgent') }} ↗</BrandButton
              >
              <p class="text-sm text-primary-warm-gray">
                {{ t('vfxV3.studio.agentUnavailable') }}
              </p>
            </div>
          </TabsContent>
        </TabsRoot>
      </GlassCard>
    </div>
  </div>
</template>
