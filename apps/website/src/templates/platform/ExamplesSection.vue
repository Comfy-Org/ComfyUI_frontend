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
    tags: ['Models API', 'Seedance', 'Next.js'],
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
        size="sm"
        variant="outline"
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
        class="focus-visible:ring-primary-comfy-yellow bg-transparency-white-t4 group flex flex-col gap-4 rounded-4xl p-2 transition-colors duration-200 hover:bg-transparency-white-t8 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <div
          :class="
            cn(
              'relative aspect-4/3 overflow-hidden rounded-[1.75rem] transition-opacity group-hover:opacity-90',
              example.bg
            )
          "
        >
          <div
            class="pointer-events-none absolute inset-0 bg-linear-to-t from-primary-comfy-ink/80 via-primary-comfy-ink/20 to-transparent"
            aria-hidden="true"
          />
          <div class="absolute inset-x-0 bottom-0 p-5">
            <h3 class="text-lg/snug font-medium text-primary-warm-white">
              {{ example.title }}
            </h3>
            <p
              class="mt-2 max-w-xl text-xs/relaxed font-light text-primary-comfy-canvas"
            >
              {{ example.description }}
            </p>
          </div>
        </div>
        <div class="flex flex-1 flex-col gap-4 px-4 pb-4">
          <div class="flex items-center justify-between gap-2">
            <span
              class="text-primary-comfy-yellow text-xs font-bold tracking-wider uppercase"
            >
              {{ t('platform.examples.cookbook', locale) }}
            </span>
            <span
              class="bg-primary-comfy-yellow flex size-8 shrink-0 items-center justify-center rounded-full"
              aria-hidden="true"
            >
              <img src="/icons/arrow-right.svg" alt="" class="size-2.5" />
            </span>
          </div>
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <span
              v-for="tag in example.tags"
              :key="tag"
              class="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs text-primary-comfy-canvas"
            >
              {{ tag }}
            </span>
          </div>
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
        <h3 class="text-base font-normal text-primary-warm-white">
          {{ example.title }}
        </h3>
        <p class="mt-2 text-xs/relaxed font-light text-primary-comfy-canvas">
          {{ example.description }}
        </p>
        <div class="mt-auto flex flex-wrap gap-2 pt-4">
          <span
            v-for="tag in example.tags"
            :key="tag"
            class="rounded-full bg-white/5 px-3 py-1 text-xs text-primary-comfy-canvas"
          >
            {{ tag }}
          </span>
        </div>
      </a>
    </div>
  </section>
</template>
