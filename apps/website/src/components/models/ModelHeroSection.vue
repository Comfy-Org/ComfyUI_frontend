<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import BrandButton from '@/components/common/BrandButton.vue'
import { translationsFor } from '@/i18n/translations'

import { modelHeroActions } from './modelHeroActions'

const { t } = translationsFor('en')
const {
  displayName,
  huggingFaceUrl,
  docsUrl,
  blogUrl,
  hubSlug,
  workflowCount,
  directory,
  localFile = false
} = defineProps<{
  displayName: string
  huggingFaceUrl: string
  docsUrl?: string
  blogUrl?: string
  hubSlug?: string
  workflowCount: number
  directory: string
  /** Shown at the Hub address, where the page is about the file itself. */
  localFile?: boolean
}>()

const actions = modelHeroActions({
  huggingFaceUrl,
  docsUrl,
  hubSlug,
  directory,
  localFile
})

const dirDisplayMap: Record<string, string> = {
  diffusion_models: 'Diffusion Model',
  checkpoints: 'Checkpoint',
  loras: 'LoRA',
  controlnet: 'ControlNet',
  clip_vision: 'CLIP Vision',
  model_patches: 'Model Patch',
  vae: 'VAE',
  text_encoders: 'Text Encoder',
  audio_encoders: 'Audio Encoder',
  latent_upscale_models: 'Latent Upscale Model',
  upscale_models: 'Upscale Model',
  style_models: 'Style Model',
  partner_nodes: 'Partner Node'
}

const eyebrow = dirDisplayMap[directory] ?? directory
</script>

<template>
  <section
    :class="
      cn(
        'mx-auto flex max-w-7xl flex-col gap-8 px-6 py-16',
        'lg:flex-row lg:items-center lg:gap-16 lg:px-8 lg:py-24'
      )
    "
  >
    <div class="flex max-w-2xl flex-1 flex-col gap-6">
      <p
        class="text-sm font-medium tracking-widest text-primary-comfy-yellow uppercase"
      >
        {{ eyebrow }}
      </p>

      <h1 class="text-4xl font-bold text-primary-comfy-canvas lg:text-6xl">
        {{ displayName }} in ComfyUI
      </h1>

      <p class="text-sm text-primary-comfy-canvas/60">
        {{ t('models.hero.workflowCount', { count: workflowCount }) }}
      </p>

      <div class="flex flex-col gap-3 sm:flex-row">
        <BrandButton
          v-for="action in actions"
          :key="action.labelKey"
          :href="action.href"
          :target="action.external ? '_blank' : undefined"
          :rel="action.external ? 'noopener noreferrer' : undefined"
          :variant="action.variant"
          size="lg"
          class="w-full uppercase sm:w-auto sm:min-w-48"
          :data-testid="action.testId"
        >
          {{ t(action.labelKey) }}
        </BrandButton>
      </div>

      <div v-if="blogUrl" class="text-sm text-primary-comfy-canvas/60">
        <a
          :href="blogUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-primary-comfy-canvas"
        >
          {{ t('models.hero.blogLink') }}
        </a>
      </div>
    </div>
  </section>
</template>
