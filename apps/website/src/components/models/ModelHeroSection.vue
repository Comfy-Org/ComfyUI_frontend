<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import BrandButton from '../common/BrandButton.vue'
import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'

const {
  displayName,
  huggingFaceUrl,
  docsUrl,
  blogUrl,
  workflowCount,
  directory
} = defineProps<{
  displayName: string
  huggingFaceUrl: string
  docsUrl?: string
  blogUrl?: string
  workflowCount: number
  directory: string
}>()

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
const isPartnerNode = directory === 'partner_nodes'
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
        class="text-sm font-medium uppercase tracking-widest text-primary-comfy-yellow"
      >
        {{ eyebrow }}
      </p>

      <h1 class="text-4xl font-bold text-primary-comfy-canvas lg:text-6xl">
        {{ displayName }} in ComfyUI
      </h1>

      <p class="text-sm text-primary-comfy-canvas/60">
        {{
          t('models.hero.workflowCount').replace(
            '{count}',
            String(workflowCount)
          )
        }}
      </p>

      <div class="flex flex-col gap-3 sm:flex-row">
        <BrandButton
          :href="externalLinks.workflows"
          variant="solid"
          size="lg"
          class="w-full uppercase sm:w-auto sm:min-w-48"
        >
          {{ t('models.hero.primaryCta') }}
        </BrandButton>

        <BrandButton
          v-if="!isPartnerNode"
          :href="huggingFaceUrl"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          size="lg"
          class="w-full uppercase sm:w-auto sm:min-w-48"
        >
          {{ t('models.hero.secondaryCta') }}
        </BrandButton>

        <BrandButton
          v-if="docsUrl"
          :href="docsUrl"
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          size="lg"
          class="w-full uppercase sm:w-auto sm:min-w-48"
        >
          {{ t('models.hero.tutorialCta') }}
        </BrandButton>
      </div>

      <div v-if="blogUrl" class="text-sm text-primary-comfy-canvas/60">
        <a
          :href="blogUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-primary-comfy-canvas underline"
        >
          {{ t('models.hero.blogLink') }}
        </a>
      </div>
    </div>
  </section>
</template>
