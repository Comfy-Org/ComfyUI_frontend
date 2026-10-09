<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import HeroSplit01 from '@/components/blocks/HeroSplit01.vue'
import VideoPlayer from '@/components/common/VideoPlayer.vue'
import HubWorkflowThumbnail from '@/components/hub/HubWorkflowThumbnail.vue'
import { vfxWorkflows } from '@/data/vfxWorkflows'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { resolveTemplateLogos } from '@/lib/hub/model-logos'

const {
  locale,
  agency = false,
  primaryHref
} = defineProps<{
  locale: Locale
  agency?: boolean
  primaryHref: string
}>()

const { t } = translationsFor(locale)
const heroKey = computed(() => (agency ? 'agency' : 'comfy'))
const examples = [
  { id: 'upscale', workflow: vfxWorkflows[5] },
  {
    id: 'cleanplate',
    workflow: vfxWorkflows[2],
    videoSrc:
      'https://media.comfy.org/hub-media/video/8a3a846f-5017-428e-b2a2-24025c55e884.mp4'
  },
  { id: 'restyling', workflow: vfxWorkflows[1] }
] as const
const selectedId = ref<(typeof examples)[number]['id']>('upscale')
const selected = computed(
  () =>
    examples.find((example) => example.id === selectedId.value) ?? examples[0]
)
const modelLogos = computed(() =>
  resolveTemplateLogos(selected.value.workflow.template)
)
</script>

<template>
  <HeroSplit01
    data-testid="vfx-proof-hero"
    :locale
    :badge-text="t(`vfxV2.${heroKey}.badge`).toLocaleUpperCase(locale)"
    :title="t(`vfxV2.${heroKey}.heroTitle`)"
    :subtitle="t(`vfxV2.${heroKey}.heroDescription`)"
    :primary-cta="{
      label: t(`vfxV2.${heroKey}.primaryCta`),
      href: primaryHref
    }"
    :secondary-cta="{
      label: t('vfxV2.shared.secondaryCta'),
      href: '#approach'
    }"
    class="lg:gap-12 lg:[&>div:first-child]:flex-[0.8]"
    media-wrapper-class="order-none lg:flex-[1.2]"
    title-class="text-3xl tracking-tight md:text-4xl lg:text-4xl"
    subtitle-class="max-w-lg text-base"
    cta-wrapper-class="sm:flex-wrap"
  >
    <template #media>
      <div class="w-full space-y-4">
        <div
          role="group"
          :aria-label="t('vfxV2.proof.label')"
          class="flex flex-wrap gap-2"
        >
          <button
            v-for="example in examples"
            :key="example.id"
            type="button"
            :aria-pressed="selectedId === example.id"
            :class="
              cn(
                'rounded-full border px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-primary-comfy-ink',
                selectedId === example.id
                  ? 'border-primary-comfy-yellow bg-primary-comfy-yellow text-primary-comfy-ink'
                  : 'border-primary-comfy-canvas/20 bg-primary-comfy-ink-light text-primary-comfy-canvas hover:border-primary-comfy-canvas/60'
              )
            "
            @click="selectedId = example.id"
          >
            {{ t(`vfxV2.proof.${example.id}`) }}
          </button>
        </div>

        <div v-if="'videoSrc' in selected" class="relative">
          <VideoPlayer
            :key="selected.id"
            :locale
            :src="selected.videoSrc"
            :poster="selected.workflow.template.thumbnails[0]"
            :aria-label="t(`vfxV2.proof.${selected.id}`)"
            persistent-controls
          />
          <span
            class="pointer-events-none absolute top-5 left-5 rounded-full bg-primary-comfy-ink/80 px-3 py-1.5 text-xs text-primary-comfy-canvas backdrop-blur-sm"
          >
            {{ t('vfxV2.proof.demoLabel') }}
          </span>
          <span
            v-if="modelLogos.length"
            class="pointer-events-none absolute top-5 right-5 flex gap-2 rounded-xl bg-primary-comfy-ink/80 p-2 backdrop-blur-sm"
          >
            <span
              v-for="logo in modelLogos"
              :key="logo.src"
              role="img"
              :aria-label="logo.name"
              class="size-5 bg-primary-warm-white mask-contain mask-center mask-no-repeat"
              :style="{ maskImage: `url(${logo.src})` }"
            />
          </span>
        </div>
        <div v-else class="[&>div]:aspect-video">
          <HubWorkflowThumbnail
            :key="selected.id"
            :locale
            :template="selected.workflow.template"
            :href="selected.workflow.href"
            :show-type-badge="false"
            provider-badge-at-top
          />
        </div>

        <div aria-live="polite" class="space-y-1 px-1">
          <p class="text-sm text-primary-comfy-canvas/80">
            {{ t(`vfxV2.proof.${selected.id}Description`) }}
          </p>
          <p
            v-if="selected.id === 'upscale'"
            class="text-xs text-primary-comfy-canvas/60"
          >
            {{ t('vfxV2.proof.compareHint') }}
          </p>
        </div>
      </div>
    </template>
  </HeroSplit01>
</template>
