<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface IncludedFeature {
  title: string
  description: string
  isComingSoon?: boolean
}

const features: IncludedFeature[] = [
  {
    title: 'Machine Setup',
    description: 'Comfy Cloud runs on Blackwell RTX 6000 Pro – 96GB VRAM'
  },
  {
    title: 'Time limit per job',
    description:
      'Each workflow run has a maximum duration of 30 minutes. On the Pro plan, the time limit is increased to 1 hour. Jobs exceeding that limit are automatically cancelled to ensure fair usage and system stability.'
  },
  {
    title: 'Usage',
    description:
      "You're only charged for <strong>active GPU</strong> time while a workflow is running. Idle time (e.g. time spent building workflows) does not consume GPU hours."
  },
  {
    title: 'Credit balance',
    description:
      'All plans will include a monthly pool of credits that are spent on active workflow runtime and <a href="https://docs.comfy.org" class="text-primary-comfy-yellow underline">Partner Nodes</a> like Nano Banana Pro.'
  },
  {
    title: 'Add more credits anytime',
    description:
      'Purchase additional credits at any time. Unused top-ups roll over to the next month automatically for up to 1 year.'
  },
  {
    title: 'Pre-installed models',
    description: 'Access a library of 900+ pre-installed models.'
  },
  {
    title: 'Custom nodes support',
    description:
      'Comfy Cloud currently supports a variety of the most-used custom nodes from the ComfyUI community. <a href="https://docs.comfy.org" class="text-primary-comfy-yellow underline">Check out which nodes we support currently.</a> We\'re expanding support regularly based on demand and compatibility. <a href="https://docs.comfy.org" class="text-primary-comfy-yellow underline">See which nodes we\'re working on adding.</a>'
  },
  {
    title: 'Partner Nodes',
    description:
      'Run <strong>proprietary models</strong> through Comfy\'s <a href="https://docs.comfy.org" class="text-primary-comfy-yellow underline">Partner Nodes</a>, such as Nano Banana. The amount of credits each node uses depends on the model and parameters you set in the node, but these credits are the same ones that your monthly subscription comes with. These credits can also be used across Comfy Cloud and local ComfyUI. Read more about Partner nodes <a href="https://docs.comfy.org" class="text-primary-comfy-yellow underline">here</a>.'
  },
  {
    title: 'Job queue',
    description: 'Queue up to 100 workflows at once.'
  },
  {
    title: 'Custom LoRA importing',
    description:
      'For those on the Creator or Pro plans, you can bring in your own models & LoRAs from CivitAI or Huggingface to perfect your own style.'
  },
  {
    title: 'Parallel job execution',
    description:
      'Run multiple workflows in parallel to speed up your pipeline.',
    isComingSoon: true
  }
]
</script>

<template>
  <section class="px-4 py-16 lg:px-20 lg:py-24">
    <div class="mx-auto w-full lg:grid lg:grid-cols-[280px_1fr] lg:gap-x-16">
      <!-- Heading -->
      <div
        class="bg-primary-comfy-ink sticky top-20 mb-10 py-2 lg:top-28 lg:mb-0 lg:self-start"
      >
        <h2
          class="text-primary-comfy-canvas text-3xl/tight font-light whitespace-pre-line"
        >
          {{ t('pricing.included.heading', locale) }}
        </h2>
      </div>

      <!-- Features list -->
      <div>
        <div
          v-for="(feature, index) in features"
          :key="feature.title"
          :class="
            index < features.length - 1
              ? 'border-primary-comfy-canvas/15 border-b border-dashed'
              : ''
          "
          class="py-8 first:pt-0 lg:grid lg:grid-cols-[200px_1fr] lg:gap-x-10"
        >
          <!-- Title -->
          <div class="flex items-start gap-3">
            <span
              :class="
                feature.isComingSoon
                  ? 'text-primary-comfy-yellow/60'
                  : 'text-primary-comfy-yellow'
              "
              class="mt-0.5 text-sm leading-none"
            >
              {{ feature.isComingSoon ? '⏳' : '✓' }}
            </span>
            <div>
              <p class="text-primary-comfy-canvas text-sm font-medium">
                {{ feature.title }}
              </p>
              <span
                v-if="feature.isComingSoon"
                class="text-primary-comfy-yellow mt-1 inline-block text-xs"
              >
                coming soon
              </span>
            </div>
          </div>

          <!-- Description -->
          <p
            class="text-primary-comfy-canvas/55 mt-3 text-sm/relaxed lg:mt-0"
            v-html="feature.description"
          />
        </div>
      </div>
    </div>
  </section>
</template>
