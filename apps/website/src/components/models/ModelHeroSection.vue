<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import CardWorkflow01 from '../blocks/CardWorkflow01.vue'
import type { CardWorkflowItem } from '../blocks/CardWorkflow01.vue'
import BrandButton from '../common/BrandButton.vue'
import { t } from '../../i18n/translations'

const {
  displayName,
  docsUrl,
  blogUrl,
  hubSlug,
  workflowCount,
  directory,
  featuredWorkflow
} = defineProps<{
  displayName: string
  docsUrl?: string
  blogUrl?: string
  hubSlug?: string
  workflowCount: number
  directory: string
  featuredWorkflow?: CardWorkflowItem
}>()

const workflowsUrl = hubSlug
  ? `https://www.comfy.org/workflows/model/${hubSlug}`
  : null

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
        class="text-primary-comfy-yellow text-sm font-medium tracking-widest uppercase"
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
          v-if="workflowsUrl"
          :href="workflowsUrl"
          variant="solid"
          size="lg"
          class="w-full uppercase sm:w-auto sm:min-w-48"
        >
          {{ t('models.hero.primaryCta') }}
        </BrandButton>

        <BrandButton
          v-if="!workflowsUrl"
          href="https://www.comfy.org/cloud"
          target="_blank"
          rel="noopener noreferrer"
          variant="solid"
          size="lg"
          class="w-full uppercase sm:w-auto sm:min-w-48"
        >
          {{ t('models.hero.cloudCta') }}
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
          class="underline hover:text-primary-comfy-canvas"
        >
          {{ t('models.hero.blogLink') }}
        </a>
      </div>
    </div>

    <div v-if="featuredWorkflow" class="w-full flex-1 lg:max-w-2xl">
      <CardWorkflow01 :item="featuredWorkflow" variant="feature" />
    </div>
  </section>
</template>
