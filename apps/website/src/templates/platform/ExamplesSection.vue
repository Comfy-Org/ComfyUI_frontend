<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import SectionHeader from '../../components/common/SectionHeader.vue'
import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface Example {
  id: string
  title: string
  description: string
  tags: string[]
  bg: string
}

const featured: Example[] = [
  {
    id: 'try-on',
    title: t('platform.examples.tryOn.title', locale),
    description: t('platform.examples.tryOn.description', locale),
    tags: ['Next.js', 'Serverless API'],
    bg: 'bg-primary-comfy-plum'
  },
  {
    id: 'higgsfield',
    title: t('platform.examples.higgsfield.title', locale),
    description: t('platform.examples.higgsfield.description', locale),
    tags: ['Comfy Router', 'Seedance', 'Next.js'],
    bg: 'bg-secondary-mauve'
  }
]

const more: Omit<Example, 'bg'>[] = [
  {
    id: 'emoji',
    title: t('platform.examples.emoji.title', locale),
    description: t('platform.examples.emoji.description', locale),
    tags: ['JavaScript', 'Cloud API']
  },
  {
    id: 'dcc',
    title: t('platform.examples.dcc.title', locale),
    description: t('platform.examples.dcc.description', locale),
    tags: ['Photoshop', 'Blender', 'Serverless API']
  },
  {
    id: 'agent',
    title: t('platform.examples.agent.title', locale),
    description: t('platform.examples.agent.description', locale),
    tags: ['comfy-cli', 'MCP', 'Builder']
  },
  {
    id: 'sprite',
    title: t('platform.examples.sprite.title', locale),
    description: t('platform.examples.sprite.description', locale),
    tags: ['Python', 'Serverless API']
  },
  {
    id: 'discord',
    title: t('platform.examples.discord.title', locale),
    description: t('platform.examples.discord.description', locale),
    tags: ['Webhooks', 'Serverless API']
  },
  {
    id: 'hub',
    title: t('platform.examples.hub.title', locale),
    description: t('platform.examples.hub.description', locale),
    tags: ['Hub', 'Serverless API']
  }
]
</script>

<template>
  <section
    id="examples"
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-10 lg:scroll-mt-36 lg:py-14"
  >
    <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <SectionHeader max-width="xl" heading-size="compact" align="start">
        {{ t('platform.examples.heading', locale) }}
        <template #subtitle>
          <p class="mt-4 text-sm text-smoke-700">
            {{ t('platform.examples.subtitle', locale) }}
          </p>
        </template>
      </SectionHeader>
      <Button
        as="a"
        :href="externalLinks.docsPlatformExamples"
        target="_blank"
        rel="noopener noreferrer"
        variant="underlineLink"
      >
        {{ t('platform.examples.viewAll', locale) }}
      </Button>
    </div>

    <!-- Featured: the flagship builds, with their output front and center -->
    <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <a
        v-for="example in featured"
        :key="example.id"
        :href="externalLinks.docsPlatformExamples"
        target="_blank"
        rel="noopener noreferrer"
        class="focus-visible:ring-primary-comfy-yellow/50 group flex flex-col overflow-hidden rounded-3xl border border-white/10 transition-colors hover:border-white/25 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div
          :class="
            cn(
              'flex aspect-2/1 items-end p-4 transition-opacity group-hover:opacity-90',
              example.bg
            )
          "
        >
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="tag in example.tags"
              :key="tag"
              class="rounded-full bg-primary-comfy-ink/70 px-2.5 py-1 font-mono text-[10px] text-primary-comfy-canvas"
            >
              {{ tag }}
            </span>
          </div>
        </div>
        <div class="bg-transparency-white-t4 flex flex-1 flex-col p-6">
          <h3 class="text-base font-normal text-primary-warm-white">
            {{ example.title }}
          </h3>
          <p class="mt-2 text-xs/relaxed font-light text-primary-comfy-canvas">
            {{ example.description }}
          </p>
          <span
            class="text-primary-comfy-yellow mt-auto pt-4 text-xs font-bold tracking-wider uppercase"
          >
            {{ t('platform.examples.cookbook', locale) }}
          </span>
        </div>
      </a>
    </div>

    <!-- The rest of the gallery, compact -->
    <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <a
        v-for="example in more"
        :key="example.id"
        :href="externalLinks.docsPlatformExamples"
        target="_blank"
        rel="noopener noreferrer"
        class="focus-visible:ring-primary-comfy-yellow/50 bg-transparency-white-t4 flex flex-col rounded-3xl border border-white/10 p-5 transition-colors hover:border-white/25 focus-visible:ring-2 focus-visible:outline-none"
      >
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="tag in example.tags"
            :key="tag"
            class="rounded-full bg-primary-comfy-ink/70 px-2.5 py-1 font-mono text-[10px] text-primary-comfy-canvas"
          >
            {{ tag }}
          </span>
        </div>
        <h3 class="mt-4 text-base font-normal text-primary-warm-white">
          {{ example.title }}
        </h3>
        <p class="mt-2 text-xs/relaxed font-light text-primary-comfy-canvas">
          {{ example.description }}
        </p>
      </a>
    </div>
  </section>
</template>
